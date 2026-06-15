"""Service layer: orchestrates the API client, demo data, and analysis.

Routers depend only on this module so they don't need to know whether data is
live (token configured) or sampled (demo mode).
"""

from __future__ import annotations

from . import analysis, demo_data
from .coc_client import CocClient, normalize_tag
from .config import Settings
from .models import RecruitmentReport, WarReport
from .store import SnapshotStore


class ClanService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = CocClient(settings)
        self._store = SnapshotStore(settings.data_dir)

    @property
    def demo_mode(self) -> bool:
        return not self._settings.is_api_configured

    def _clan_tag(self, clan_tag: str | None) -> str:
        tag = clan_tag or self._settings.coc_clan_tag or demo_data.DEMO_CLAN_TAG
        return normalize_tag(tag)

    # --- Raw-ish fetches -------------------------------------------------

    async def get_clan(self, clan_tag: str | None = None) -> dict:
        if self.demo_mode:
            return demo_data.DEMO_CLAN
        return await self._client.get_clan(self._clan_tag(clan_tag))

    async def _get_members(self, clan_tag: str | None = None) -> list[dict]:
        if self.demo_mode:
            return demo_data.DEMO_MEMBERS
        return await self._client.get_members(self._clan_tag(clan_tag))

    # --- Composed views --------------------------------------------------

    async def get_overview(self, clan_tag: str | None = None) -> dict:
        clan = await self.get_clan(clan_tag)
        members = await self._get_members(clan_tag)
        roster = analysis.build_roster(members, self._settings)
        total_donations = sum(m.donations for m in roster)
        flagged = [m for m in roster if m.flags]
        promotion = [m for m in roster if m.promotion_candidate]
        return {
            "demo_mode": self.demo_mode,
            "clan": {
                "tag": clan.get("tag"),
                "name": clan.get("name"),
                "level": clan.get("clanLevel"),
                "points": clan.get("clanPoints"),
                "members": clan.get("members", len(members)),
                "war_wins": clan.get("warWins"),
                "war_win_streak": clan.get("warWinStreak"),
                "required_townhall": clan.get("requiredTownhallLevel"),
                "required_trophies": clan.get("requiredTrophies"),
                "description": clan.get("description"),
            },
            "stats": {
                "member_count": len(roster),
                "total_donations": total_donations,
                "avg_donations": round(total_donations / len(roster))
                if roster
                else 0,
                "flagged_count": len(flagged),
                "promotion_candidates": len(promotion),
            },
        }

    async def get_roster(self, clan_tag: str | None = None) -> list[dict]:
        members = await self._get_members(clan_tag)
        tag = self._clan_tag(clan_tag)
        previous = self._store.load(tag)
        roster = analysis.build_roster(members, self._settings, previous)
        return [m.model_dump() for m in roster]

    async def snapshot(self, clan_tag: str | None = None) -> dict:
        """Save a roster snapshot so future refreshes can show deltas."""
        members = await self._get_members(clan_tag)
        tag = self._clan_tag(clan_tag)
        saved = self._store.save(tag, members)
        return {"saved": True, "captured_at": saved["captured_at"],
                "member_count": len(saved["members"])}

    async def get_war(self, clan_tag: str | None = None) -> WarReport | None:
        if self.demo_mode:
            war = demo_data.DEMO_WAR
        else:
            war = await self._client.get_current_war(self._clan_tag(clan_tag))
        return analysis.analyze_war(war)

    async def screen_recruit(self, player_tag: str) -> RecruitmentReport:
        if self.demo_mode:
            player = demo_data.DEMO_PROSPECTS.get(
                normalize_tag(player_tag),
                # Default demo prospect so any tag returns something sensible.
                {
                    "tag": normalize_tag(player_tag), "name": "Demo Player",
                    "townHallLevel": 13, "trophies": 3000, "bestTrophies": 3500,
                    "warStars": 600, "donations": 400, "donationsReceived": 500,
                    "warPreference": "in", "clan": None,
                },
            )
        else:
            player = await self._client.get_player(player_tag)
        return analysis.score_recruit(player, self._settings)
