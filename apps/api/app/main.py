from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

    api.include_router(leagues_router)

    return api


app = create_app()
