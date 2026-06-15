"""Pydantic models for the tool's computed responses.

Raw Clash of Clans API payloads are passed through as dicts to stay resilient
to upstream field changes; these models describe the data *this tool* derives.
"""

from __future__ import annotations

from pydantic import BaseModel


class RecruitmentReport(BaseModel):
    """Result of screening a prospective member."""

    tag: str
    name: str
    town_hall: int
    trophies: int
    best_trophies: int
    war_stars: int
    donations: int
    donations_received: int
    donation_ratio: float
    war_opted_in: bool | None
    current_clan: str | None

    score: int  # 0-100 fit score
    verdict: str  # "strong", "consider", "weak"
    passed: list[str]
    concerns: list[str]


class MemberInsight(BaseModel):
    """A roster member enriched with management metrics."""

    tag: str
    name: str
    role: str
    town_hall: int
    trophies: int
    clan_rank: int
    donations: int
    donations_received: int
    donation_ratio: float
    contribution_score: int
    flags: list[str]
    promotion_candidate: bool

    # Deltas vs the previous saved snapshot (None if no prior snapshot).
    donations_delta: int | None = None
    trophies_delta: int | None = None


class WarMemberPerformance(BaseModel):
    """A single member's performance in the current/most recent war."""

    tag: str
    name: str
    map_position: int
    town_hall: int
    attacks_used: int
    attacks_available: int
    stars: int
    missed_attacks: int


class WarReport(BaseModel):
    """Summary of the current war."""

    state: str
    team_size: int
    clan_name: str
    opponent_name: str
    clan_stars: int
    opponent_stars: int
    clan_destruction: float
    opponent_destruction: float
    attacks_used: int
    attacks_available: int
    members_with_missed_attacks: list[WarMemberPerformance]
    members: list[WarMemberPerformance]
