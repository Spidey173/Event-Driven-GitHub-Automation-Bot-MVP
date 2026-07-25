import json
from typing import List, Union
from pydantic import BeforeValidator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated

def parse_cors(v: Union[str, List[str]]) -> List[str]:
    """Helper to parse list of origins from env variable."""
    if isinstance(v, str):
        if not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        try:
            return json.loads(v)
        except json.JSONDecodeError:
            return [v.strip()]
    return v

def normalize_db_url(v: str) -> str:
    """Helper to convert postgresql:// or postgres:// scheme to postgresql+asyncpg:// and normalize SSL params for asyncpg."""
    if isinstance(v, str):
        if v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        
        if "asyncpg" in v:
            v = v.replace("sslmode=", "ssl=")
            import re
            v = re.sub(r'[&?]channel_binding=[^&]*', '', v)
    return v

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore"
    )

    APP_NAME: str = "GitHub Automation Bot"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # Security Config
    SECRET_KEY: str
    ENCRYPTION_KEY: str

    # Database config
    DATABASE_URL: Annotated[str, BeforeValidator(normalize_db_url)]

    # CORS settings
    BACKEND_CORS_ORIGINS: Annotated[
        List[str], BeforeValidator(parse_cors)
    ] = ["http://localhost:3000"]

    # External APIs (Optional for initial bootstrap, but present in config)
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_WEBHOOK_SECRET: str = ""
    
    # Webhook callback configuration base
    WEBHOOK_BASE_URL: str = "http://localhost:8000"

settings = Settings(_env_file=".env")
