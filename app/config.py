"""Application configuration loaded from environment variables / .env."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings.

    Values are read from environment variables (and a local .env file if
    present). See .env.example for documentation of each field.
    """

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    coc_api_token: str = ""
    coc_clan_tag: str = ""

    coc_api_base_url: str = "https://api.clashofclans.com/v1"
    coc_request_timeout: float = 15.0

    # Recruitment requirements.
    recruit_min_townhall: int = 12
    recruit_min_trophies: int = 2000
    recruit_min_war_stars: int = 200
    recruit_min_donation_ratio: float = 0.5
    recruit_require_war_opt_in: bool = True

    # Member management.
    inactive_donation_floor: int = 100

    # Local snapshot store (relative to project root).
    data_dir: str = "data"

    @property
    def is_api_configured(self) -> bool:
        """True when a token and default clan tag are both present."""
        return bool(self.coc_api_token and self.coc_clan_tag)


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
