from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.leagues import router as leagues_router
from app.core.config import get_settings
from app.schemas.health import HealthResponse


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
            from app.models import User
            from app.services.auth import hash_password
            from sqlmodel import Session, select

            with Session(engine) as session:
                email = settings.initial_admin_email.lower()
                user = session.exec(select(User).where(User.email == email)).first()
                if user is None:
                    session.add(
                        User(
                            email=email,
                            password_hash=hash_password(settings.initial_admin_password),
                            password=settings.initial_admin_password,
                            role="admin",
                            is_active=True,
                        )
                    )
                    session.commit()
                elif user.password is None:
                    user.password = settings.initial_admin_password
                    session.add(user)
                    session.commit()

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


app = create_app()
