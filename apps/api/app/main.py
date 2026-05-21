from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from app.api.routes.auth import router as auth_router
from app.api.routes.leagues import router as leagues_router
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

        yield

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

    return api


def ensure_initial_admin_user(session: Session, email: str, password: str) -> None:
    normalized_email = email.lower()
    user = session.exec(select(User).where(User.email == normalized_email)).first()
    if user is None:
        session.add(
            User(
                email=normalized_email,
                password_hash=hash_password(password),
                password=password,
                role="admin",
                is_active=True,
            )
        )
        session.commit()
        return

    if user.password == password and verify_password(password, user.password_hash):
        return

    if user.password is None or user.password == password:
        user.password_hash = hash_password(password)
        user.password = password
        session.add(user)
        session.commit()


app = create_app()
