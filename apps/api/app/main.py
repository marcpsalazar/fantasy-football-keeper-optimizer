from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from app.api.routes.auth import router as auth_router
from app.api.routes.leagues import router as leagues_router
from app.api.routes.mock_drafts import router as mock_drafts_router
from app.core.config import get_settings
from app.models import User
from app.schemas.health import HealthResponse
from app.services.auth import hash_password, verify_password


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(api: FastAPI):
        if settings.create_tables_on_startup:
            from app.db.session import init_db

            init_db()

        if settings.seed_data_on_startup:
            from app.db.seed import seed_database

            seed_database(create_tables=not settings.create_tables_on_startup)

        if settings.initial_admin_email and settings.initial_admin_password:
            from app.db.session import engine

            with Session(engine) as session:
                ensure_initial_admin_user(
                    session,
                    settings.initial_admin_email,
                    settings.initial_admin_password,
                )

        adp_refresh_task: asyncio.Task[None] | None = None
        player_status_task: asyncio.Task[None] | None = None
        if settings.adp_auto_refresh_enabled:
            from app.services.adp_scheduler import (
                daily_player_status_refresh_loop,
                weekly_adp_refresh_loop,
            )

            adp_refresh_task = asyncio.create_task(weekly_adp_refresh_loop(settings))
            player_status_task = asyncio.create_task(daily_player_status_refresh_loop(settings))

        from app.services.email_scheduler import email_reminder_loop
        email_task: asyncio.Task[None] = asyncio.create_task(email_reminder_loop(settings))

        try:
            yield
        finally:
            for task in (adp_refresh_task, player_status_task, email_task):
                if task is not None:
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass

    api = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

    api.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @api.get("/health", response_model=HealthResponse, tags=["health"])
    def health_check() -> HealthResponse:
        return HealthResponse(status="ok", service=settings.app_name)

    api.include_router(auth_router)
    api.include_router(leagues_router)
    api.include_router(mock_drafts_router)

    return api


def ensure_initial_admin_user(session: Session, email: str, password: str) -> None:
    normalized_email = email.lower()
    user = session.exec(select(User).where(User.email == normalized_email)).first()
    if user is None:
        session.add(
            User(
                email=normalized_email,
                password_hash=hash_password(password),
                role="admin",
                is_active=True,
            )
        )
        session.commit()
        return

    if verify_password(password, user.password_hash):
        return


app = create_app()
