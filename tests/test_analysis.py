"""Unit tests for the pure analysis layer (no network required)."""

from __future__ import annotations

import pytest

from app.analysis import (
    analyze_war,
    build_roster,
    donation_ratio,
    score_recruit,
)
from app.config import Settings
from app.demo_data import DEMO_MEMBERS, DEMO_PROSPECTS, DEMO_WAR


@pytest.fixture
def settings() -> Settings:
    # Explicit thresholds so tests don't depend on env/.env.
    return Settings(
        recruit_min_townhall=12,
        recruit_min_trophies=2000,
        recruit_min_war_stars=200,
        recruit_min_donation_ratio=0.5,
        recruit_require_war_opt_in=True,
        inactive_donation_floor=100,
    )


# --- donation_ratio --------------------------------------------------------


def test_donation_ratio_normal():
    assert donation_ratio(500, 1000) == 0.5


def test_donation_ratio_zero_received_returns_given():
    assert donation_ratio(300, 0) == 300.0


def test_donation_ratio_all_zero():
    assert donation_ratio(0, 0) == 0.0


# --- recruitment scoring ---------------------------------------------------


def test_strong_recruit(settings):
    report = score_recruit(DEMO_PROSPECTS["#GOOD"], settings)
    assert report.verdict == "strong"
    assert report.score == 100
    assert not report.concerns


def test_weak_recruit_has_concerns(settings):
    report = score_recruit(DEMO_PROSPECTS["#WEAK"], settings)
    assert report.verdict == "weak"
    assert report.score < 55
    assert any("Town Hall" in c for c in report.concerns)
    assert any("war" in c.lower() for c in report.concerns)


def test_score_is_bounded(settings):
    for player in DEMO_PROSPECTS.values():
        report = score_recruit(player, settings)
        assert 0 <= report.score <= 100


def test_war_opt_in_requirement(settings):
    player = {
        "tag": "#X", "name": "X", "townHallLevel": 15, "trophies": 5000,
        "bestTrophies": 5000, "warStars": 1000, "donations": 1000,
        "donationsReceived": 500, "warPreference": "out",
    }
    report = score_recruit(player, settings)
    assert report.war_opted_in is False
    assert any("opted into" in c.lower() for c in report.concerns)


# --- roster / member management --------------------------------------------


def test_roster_sorted_by_contribution(settings):
    roster = build_roster(DEMO_MEMBERS, settings)
    scores = [m.contribution_score for m in roster]
    assert scores == sorted(scores, reverse=True)
    assert len(roster) == len(DEMO_MEMBERS)


def test_low_donor_is_flagged(settings):
    roster = build_roster(DEMO_MEMBERS, settings)
    iris = next(m for m in roster if m.name == "Iris")  # 0 donations
    assert any("never donates" in f.lower() or "low donations" in f.lower()
               for f in iris.flags)


def test_snapshot_deltas(settings):
    previous = {
        "members": [
            {"tag": "#P1", "donations": 1000, "trophies": 5200},
        ]
    }
    roster = build_roster(DEMO_MEMBERS, settings, previous)
    aria = next(m for m in roster if m.tag == "#P1")
    assert aria.donations_delta == 1820 - 1000
    assert aria.trophies_delta == 5400 - 5200


def test_promotion_candidate_is_member_only(settings):
    roster = build_roster(DEMO_MEMBERS, settings)
    for m in roster:
        if m.promotion_candidate:
            assert m.role == "member"
            assert not m.flags


# --- war analysis ----------------------------------------------------------


def test_analyze_war_summary():
    report = analyze_war(DEMO_WAR)
    assert report is not None
    assert report.clan_stars == 11
    assert report.team_size == 5
    # Ember made no attacks -> 2 missed.
    ember = next(m for m in report.members if m.name == "Ember")
    assert ember.missed_attacks == 2
    assert ember in report.members_with_missed_attacks


def test_analyze_war_not_in_war():
    assert analyze_war({"state": "notInWar"}) is None


def test_war_members_sorted_by_position():
    report = analyze_war(DEMO_WAR)
    positions = [m.map_position for m in report.members]
    assert positions == sorted(positions)
