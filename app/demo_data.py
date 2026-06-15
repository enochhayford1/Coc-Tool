"""Sample data served when no API token is configured (demo mode).

Mirrors the shape of real Clash of Clans API payloads so the dashboard and
analysis layer behave identically with or without a live token.
"""

from __future__ import annotations

DEMO_CLAN_TAG = "#DEMO123"

DEMO_CLAN = {
    "tag": DEMO_CLAN_TAG,
    "name": "Demo Warriors",
    "clanLevel": 18,
    "clanPoints": 42100,
    "warWinStreak": 4,
    "warWins": 212,
    "warLosses": 58,
    "members": 10,
    "requiredTownhallLevel": 12,
    "requiredTrophies": 2000,
    "description": "Demo clan used when no API token is configured.",
}

DEMO_MEMBERS = [
    {"tag": "#P1", "name": "Aria", "role": "leader", "townHallLevel": 16,
     "trophies": 5400, "clanRank": 1, "donations": 1820, "donationsReceived": 640},
    {"tag": "#P2", "name": "Bolt", "role": "coLeader", "townHallLevel": 15,
     "trophies": 5100, "clanRank": 2, "donations": 1500, "donationsReceived": 700},
    {"tag": "#P3", "name": "Cinder", "role": "coLeader", "townHallLevel": 15,
     "trophies": 4800, "clanRank": 3, "donations": 980, "donationsReceived": 540},
    {"tag": "#P4", "name": "Drift", "role": "admin", "townHallLevel": 14,
     "trophies": 4300, "clanRank": 4, "donations": 1340, "donationsReceived": 410},
    {"tag": "#P5", "name": "Ember", "role": "member", "townHallLevel": 14,
     "trophies": 4100, "clanRank": 5, "donations": 1610, "donationsReceived": 380},
    {"tag": "#P6", "name": "Frost", "role": "member", "townHallLevel": 13,
     "trophies": 3600, "clanRank": 6, "donations": 720, "donationsReceived": 690},
    {"tag": "#P7", "name": "Gale", "role": "admin", "townHallLevel": 13,
     "trophies": 3400, "clanRank": 7, "donations": 250, "donationsReceived": 900},
    {"tag": "#P8", "name": "Haze", "role": "member", "townHallLevel": 12,
     "trophies": 2900, "clanRank": 8, "donations": 60, "donationsReceived": 540},
    {"tag": "#P9", "name": "Iris", "role": "member", "townHallLevel": 12,
     "trophies": 2600, "clanRank": 9, "donations": 0, "donationsReceived": 320},
    {"tag": "#P10", "name": "Jet", "role": "member", "townHallLevel": 11,
     "trophies": 2100, "clanRank": 10, "donations": 410, "donationsReceived": 150},
]

DEMO_WAR = {
    "state": "inWar",
    "teamSize": 5,
    "attacksPerMember": 2,
    "clan": {
        "name": "Demo Warriors",
        "stars": 11,
        "destructionPercentage": 78.4,
        "members": [
            {"tag": "#P1", "name": "Aria", "mapPosition": 1, "townhallLevel": 16,
             "attacks": [{"stars": 3, "destructionPercentage": 100},
                         {"stars": 2, "destructionPercentage": 88}]},
            {"tag": "#P2", "name": "Bolt", "mapPosition": 2, "townhallLevel": 15,
             "attacks": [{"stars": 3, "destructionPercentage": 100}]},
            {"tag": "#P4", "name": "Drift", "mapPosition": 3, "townhallLevel": 14,
             "attacks": [{"stars": 2, "destructionPercentage": 95},
                         {"stars": 1, "destructionPercentage": 60}]},
            {"tag": "#P5", "name": "Ember", "mapPosition": 4, "townhallLevel": 14,
             "attacks": []},
            {"tag": "#P7", "name": "Gale", "mapPosition": 5, "townhallLevel": 13,
             "attacks": [{"stars": 0, "destructionPercentage": 42}]},
        ],
    },
    "opponent": {
        "name": "Rival Raiders",
        "stars": 9,
        "destructionPercentage": 71.0,
    },
}

# Prospective members keyed by tag, for the recruitment lookup demo.
DEMO_PROSPECTS = {
    "#GOOD": {
        "tag": "#GOOD", "name": "Phoenix", "townHallLevel": 15, "trophies": 4600,
        "bestTrophies": 5200, "warStars": 1340, "donations": 900,
        "donationsReceived": 600, "warPreference": "in",
        "clan": {"name": "Free Agents"},
    },
    "#OKAY": {
        "tag": "#OKAY", "name": "Comet", "townHallLevel": 13, "trophies": 2400,
        "bestTrophies": 3100, "warStars": 480, "donations": 300,
        "donationsReceived": 700, "warPreference": "in",
        "clan": {"name": "Casual Crew"},
    },
    "#WEAK": {
        "tag": "#WEAK", "name": "Spark", "townHallLevel": 10, "trophies": 1500,
        "bestTrophies": 1700, "warStars": 90, "donations": 20,
        "donationsReceived": 800, "warPreference": "out", "clan": None,
    },
}
