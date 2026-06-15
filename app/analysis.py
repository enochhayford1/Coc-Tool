"""Pure analysis functions: recruitment scoring, roster metrics, war stats.

Everything here is deterministic and free of I/O so it can be unit-tested
without touching the network or the API token.
"""

from __future__ import annotations

from .config import Settings
from .models import (
    MemberInsight,
    RecruitmentReport,
    WarMemberPerformance,
    WarReport,
)

# Roles ranked from lowest to highest authority. The API uses "admin" for the
# Elder role.
ROLE_ORDER = {"member": 0, "admin": 1, "coLeader": 2, "leader": 3}
ROLE_LABELS = {
    "member": "Member",
    "admin": "Elder",
    "coLeader": "Co-leader",
    "leader": "Leader",
}


def donation_ratio(given: int, received: int) -> float:
    """Donations given divided by received.

    Returns the raw given count when nothing was received (avoids div-by-zero
    while still rewarding generous donors), and 0.0 when both are zero.
    """
    if received <= 0:
        return float(given)
    return round(given / received, 2)


def role_label(role: str) -> str:
    return ROLE_LABELS.get(role, role.title() if role else "Member")


# --- Recruitment ------------------------------------------------------------


def score_recruit(player: dict, settings: Settings) -> RecruitmentReport:
    """Screen a prospective member against the clan's requirements.

    The score is the share of weighted criteria the player satisfies, scaled
    to 0-100. ``verdict`` buckets the score into strong / consider / weak.
    """
    town_hall = player.get("townHallLevel", 0)
    trophies = player.get("trophies", 0)
    best_trophies = player.get("bestTrophies", 0)
    war_stars = player.get("warStars", 0)
    donations = player.get("donations", 0)
    received = player.get("donationsReceived", 0)
    ratio = donation_ratio(donations, received)
    war_pref = player.get("warPreference")  # "in" / "out" / None
    war_opted_in = None if war_pref is None else war_pref == "in"
    current_clan = (player.get("clan") or {}).get("name")

    passed: list[str] = []
    concerns: list[str] = []

    # Each criterion contributes its weight to the score when satisfied.
    checks = [
        (
            town_hall >= settings.recruit_min_townhall,
            30,
            f"Town Hall {town_hall} meets the TH{settings.recruit_min_townhall}+ requirement",
            f"Town Hall {town_hall} is below the TH{settings.recruit_min_townhall}+ requirement",
        ),
        (
            trophies >= settings.recruit_min_trophies,
            20,
            f"{trophies} trophies clears the {settings.recruit_min_trophies}+ bar",
            f"{trophies} trophies is under the {settings.recruit_min_trophies}+ bar",
        ),
        (
            war_stars >= settings.recruit_min_war_stars,
            20,
            f"{war_stars} war stars shows solid war experience",
            f"Only {war_stars} war stars (want {settings.recruit_min_war_stars}+)",
        ),
        (
            ratio >= settings.recruit_min_donation_ratio,
            15,
            f"Donation ratio {ratio} indicates an active, generous player",
            f"Donation ratio {ratio} is low (want {settings.recruit_min_donation_ratio}+)",
        ),
        (
            (not settings.recruit_require_war_opt_in) or war_opted_in is True,
            15,
            "Opted into clan wars",
            "Not opted into clan wars"
            if war_opted_in is False
            else "War preference unknown",
        ),
    ]

    earned = 0
    total = 0
    for ok, weight, pass_msg, concern_msg in checks:
        total += weight
        if ok:
            earned += weight
            passed.append(pass_msg)
        else:
            concerns.append(concern_msg)

    score = round(100 * earned / total) if total else 0
    if score >= 80:
        verdict = "strong"
    elif score >= 55:
        verdict = "consider"
    else:
        verdict = "weak"

    return RecruitmentReport(
        tag=player.get("tag", ""),
        name=player.get("name", "Unknown"),
        town_hall=town_hall,
        trophies=trophies,
        best_trophies=best_trophies,
        war_stars=war_stars,
        donations=donations,
        donations_received=received,
        donation_ratio=ratio,
        war_opted_in=war_opted_in,
        current_clan=current_clan,
        score=score,
        verdict=verdict,
        passed=passed,
        concerns=concerns,
    )


# --- Member management ------------------------------------------------------


def _contribution_score(donations: int, received: int, trophies: int) -> int:
    """A rough 0-100 contribution score weighting donations and trophies.

    Donations are the strongest day-to-day signal of an engaged member, so
    they dominate; trophies provide a secondary push/skill signal.
    """
    donation_points = min(donations / 30.0, 70.0)  # caps at 2100 donations
    ratio = donation_ratio(donations, received)
    ratio_points = min(ratio * 10.0, 15.0)  # caps at ratio 1.5
    trophy_points = min(trophies / 400.0, 15.0)  # caps at 6000 trophies
    return round(min(donation_points + ratio_points + trophy_points, 100.0))


def build_member_insight(
    member: dict, settings: Settings, previous: dict | None = None
) -> MemberInsight:
    """Enrich a roster member with contribution, flags, and snapshot deltas.

    ``previous`` is that member's record from the last saved snapshot, used to
    compute donation/trophy deltas (the practical way to spot inactivity).
    """
    donations = member.get("donations", 0)
    received = member.get("donationsReceived", 0)
    trophies = member.get("trophies", 0)
    role = member.get("role", "member")
    ratio = donation_ratio(donations, received)
    contribution = _contribution_score(donations, received, trophies)

    flags: list[str] = []
    donations_delta = None
    trophies_delta = None
    if previous is not None:
        donations_delta = donations - previous.get("donations", donations)
        trophies_delta = trophies - previous.get("trophies", trophies)
        if donations_delta <= 0 and trophies_delta <= 0:
            flags.append("No donations or trophy change since last snapshot")

    if donations < settings.inactive_donation_floor:
        flags.append(
            f"Low donations ({donations} < {settings.inactive_donation_floor})"
        )
    if received > 0 and donations == 0:
        flags.append("Receives but never donates")

    # Promotion candidate: strong contributor still at the lowest rank.
    promotion_candidate = (
        role == "member" and contribution >= 60 and not flags
    )

    return MemberInsight(
        tag=member.get("tag", ""),
        name=member.get("name", "Unknown"),
        role=role,
        town_hall=member.get("townHallLevel", 0),
        trophies=trophies,
        clan_rank=member.get("clanRank", 0),
        donations=donations,
        donations_received=received,
        donation_ratio=ratio,
        contribution_score=contribution,
        flags=flags,
        promotion_candidate=promotion_candidate,
        donations_delta=donations_delta,
        trophies_delta=trophies_delta,
    )


def build_roster(
    members: list[dict], settings: Settings, previous_snapshot: dict | None = None
) -> list[MemberInsight]:
    """Build insights for every member, sorted by contribution descending."""
    prev_by_tag: dict[str, dict] = {}
    if previous_snapshot:
        for m in previous_snapshot.get("members", []):
            prev_by_tag[m.get("tag", "")] = m

    insights = [
        build_member_insight(m, settings, prev_by_tag.get(m.get("tag", "")))
        for m in members
    ]
    insights.sort(key=lambda i: i.contribution_score, reverse=True)
    return insights


# --- War tracking -----------------------------------------------------------


def analyze_war(war: dict) -> WarReport | None:
    """Summarize the current war payload, including who has missed attacks.

    Returns None when the clan is not currently in a war (state
    "notInWar"), or when the war log is private.
    """
    state = war.get("state", "notInWar")
    if state == "notInWar" or "clan" not in war:
        return None

    clan = war.get("clan", {})
    opponent = war.get("opponent", {})
    team_size = war.get("teamSize", len(clan.get("members", [])))
    attacks_per_member = war.get("attacksPerMember", 2)

    members: list[WarMemberPerformance] = []
    total_used = 0
    for m in clan.get("members", []):
        attacks = m.get("attacks", []) or []
        used = len(attacks)
        stars = sum(a.get("stars", 0) for a in attacks)
        total_used += used
        members.append(
            WarMemberPerformance(
                tag=m.get("tag", ""),
                name=m.get("name", "Unknown"),
                map_position=m.get("mapPosition", 0),
                town_hall=m.get("townhallLevel", m.get("townHallLevel", 0)),
                attacks_used=used,
                attacks_available=attacks_per_member,
                stars=stars,
                missed_attacks=max(attacks_per_member - used, 0),
            )
        )

    members.sort(key=lambda p: p.map_position)
    missed = [m for m in members if m.missed_attacks > 0]

    return WarReport(
        state=state,
        team_size=team_size,
        clan_name=clan.get("name", "Our clan"),
        opponent_name=opponent.get("name", "Opponent"),
        clan_stars=clan.get("stars", 0),
        opponent_stars=opponent.get("stars", 0),
        clan_destruction=round(clan.get("destructionPercentage", 0.0), 2),
        opponent_destruction=round(opponent.get("destructionPercentage", 0.0), 2),
        attacks_used=total_used,
        attacks_available=team_size * attacks_per_member,
        members_with_missed_attacks=missed,
        members=members,
    )
