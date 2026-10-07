from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "sqlite:///./data/route53.db"
    SESSION_TTL_HOURS: int = 24
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    CORS_ORIGINS: str = "http://localhost:3000"
    DEMO_USERNAME: str = "demo"
    DEMO_PASSWORD: str = "route53demo"
    DEMO_ACCOUNT_ID: str = "123456789012"
    DEMO_DISPLAY_NAME: str = "demo-user"
    # Seed a second demo account (demo2) — used by the e2e isolation tests.
    SEED_SECOND_USER: bool = False

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
