"""Async client for the official Clash of Clans API.

Docs: https://developer.clashofclans.com/

The API is read-only and authenticated with a bearer token that is bound to
the calling server's public IP address, so the token must stay server-side.
"""

from __future__ import annotations

from urllib.parse import quote

import httpx

from .config import Settings


class CocApiError(RuntimeError):
    """Raised when the Clash of Clans API returns an error."""

    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        super().__init__(f"CoC API error {status_code}: {message}")


class CocNotConfigured(RuntimeError):
    """Raised when an API call is attempted without a configured token."""


def normalize_tag(tag: str) -> str:
    """Normalize a player/clan tag to the canonical '#XXXX' uppercase form.

    Accepts tags with or without the leading '#', and is case-insensitive.
    """
    tag = tag.strip().upper()
    if not tag.startswith("#"):
        tag = "#" + tag
    return tag


def _encode_tag(tag: str) -> str:
    """URL-encode a tag for use in a path segment ('#' -> '%23')."""
    return quote(normalize_tag(tag), safe="")


class CocClient:
    """Thin async wrapper over the Clash of Clans REST API."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def configured(self) -> bool:
        return bool(self._settings.coc_api_token)

    async def _get(self, path: str, params: dict | None = None) -> dict:
        if not self.configured:
            raise CocNotConfigured(
                "COC_API_TOKEN is not set. Add it to your .env file "
                "(see .env.example) or run in demo mode."
            )

        url = f"{self._settings.coc_api_base_url}{path}"
        headers = {
            "Authorization": f"Bearer {self._settings.coc_api_token}",
            "Accept": "application/json",
        }
        async with httpx.AsyncClient(
            timeout=self._settings.coc_request_timeout
        ) as client:
            resp = await client.get(url, headers=headers, params=params)

        if resp.status_code >= 400:
            message = resp.text
            try:
                body = resp.json()
                message = body.get("reason") or body.get("message") or message
            except ValueError:
                pass
            raise CocApiError(resp.status_code, message)

        return resp.json()

    # --- Clan endpoints -------------------------------------------------

    async def get_clan(self, clan_tag: str) -> dict:
        return await self._get(f"/clans/{_encode_tag(clan_tag)}")

    async def get_members(self, clan_tag: str) -> list[dict]:
        data = await self._get(f"/clans/{_encode_tag(clan_tag)}/members")
        return data.get("items", [])

    async def get_current_war(self, clan_tag: str) -> dict:
        return await self._get(f"/clans/{_encode_tag(clan_tag)}/currentwar")

    async def get_war_log(self, clan_tag: str, limit: int = 10) -> list[dict]:
        data = await self._get(
            f"/clans/{_encode_tag(clan_tag)}/warlog", params={"limit": limit}
        )
        return data.get("items", [])

    # --- Player endpoints -----------------------------------------------

    async def get_player(self, player_tag: str) -> dict:
        return await self._get(f"/players/{_encode_tag(player_tag)}")
