"""JSON API routes consumed by the dashboard frontend."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from ..coc_client import CocApiError, CocNotConfigured
from ..config import Settings, get_settings
from ..service import ClanService

router = APIRouter(prefix="/api", tags=["api"])


def get_service(settings: Settings = Depends(get_settings)) -> ClanService:
    return ClanService(settings)


def _handle(exc: Exception) -> HTTPException:
    if isinstance(exc, CocNotConfigured):
        return HTTPException(status_code=503, detail=str(exc))
    if isinstance(exc, CocApiError):
        # Surface the upstream status (404 unknown tag, 403 bad token/IP, ...).
        return HTTPException(status_code=exc.status_code, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


@router.get("/health")
def health(settings: Settings = Depends(get_settings)) -> dict:
    return {
        "status": "ok",
        "demo_mode": not settings.is_api_configured,
        "clan_tag": settings.coc_clan_tag or None,
        "requirements": {
            "min_townhall": settings.recruit_min_townhall,
            "min_trophies": settings.recruit_min_trophies,
            "min_war_stars": settings.recruit_min_war_stars,
            "min_donation_ratio": settings.recruit_min_donation_ratio,
            "require_war_opt_in": settings.recruit_require_war_opt_in,
        },
    }


@router.get("/overview")
async def overview(
    clan: str | None = Query(default=None),
    svc: ClanService = Depends(get_service),
) -> dict:
    try:
        return await svc.get_overview(clan)
    except Exception as exc:  # noqa: BLE001 - mapped to HTTP below
        raise _handle(exc) from exc


@router.get("/members")
async def members(
    clan: str | None = Query(default=None),
    svc: ClanService = Depends(get_service),
) -> list[dict]:
    try:
        return await svc.get_roster(clan)
    except Exception as exc:  # noqa: BLE001
        raise _handle(exc) from exc


@router.post("/snapshot")
async def snapshot(
    clan: str | None = Query(default=None),
    svc: ClanService = Depends(get_service),
) -> dict:
    try:
        return await svc.snapshot(clan)
    except Exception as exc:  # noqa: BLE001
        raise _handle(exc) from exc


@router.get("/war")
async def war(
    clan: str | None = Query(default=None),
    svc: ClanService = Depends(get_service),
) -> dict:
    try:
        report = await svc.get_war(clan)
    except Exception as exc:  # noqa: BLE001
        raise _handle(exc) from exc
    if report is None:
        return {"in_war": False}
    return {"in_war": True, "war": report.model_dump()}


@router.get("/recruit/{player_tag}")
async def recruit(
    player_tag: str,
    svc: ClanService = Depends(get_service),
) -> dict:
    try:
        return (await svc.screen_recruit(player_tag)).model_dump()
    except Exception as exc:  # noqa: BLE001
        raise _handle(exc) from exc
