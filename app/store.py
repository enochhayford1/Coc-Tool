"""Lightweight JSON snapshot store for member rosters.

Snapshots let the tool compute donation/trophy deltas between refreshes, which
is how inactivity is detected in practice (the API exposes no "last online"
field). One file per clan tag is kept under the configured data directory.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path


def _safe_name(clan_tag: str) -> str:
    """Turn a clan tag into a filesystem-safe filename stem."""
    return re.sub(r"[^A-Za-z0-9]", "", clan_tag.upper()) or "clan"


class SnapshotStore:
    """Reads and writes the most recent roster snapshot per clan."""

    def __init__(self, data_dir: str) -> None:
        self._dir = Path(data_dir)
        self._dir.mkdir(parents=True, exist_ok=True)

    def _path(self, clan_tag: str) -> Path:
        return self._dir / f"snapshot_{_safe_name(clan_tag)}.json"

    def load(self, clan_tag: str) -> dict | None:
        """Return the previously saved snapshot, or None if there isn't one."""
        path = self._path(clan_tag)
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            return None

    def save(self, clan_tag: str, members: list[dict]) -> dict:
        """Persist a snapshot of the roster and return it.

        Only the fields needed for delta computation are stored, keeping the
        files small and free of churn-prone data.
        """
        snapshot = {
            "clan_tag": clan_tag,
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "members": [
                {
                    "tag": m.get("tag", ""),
                    "name": m.get("name", ""),
                    "donations": m.get("donations", 0),
                    "donationsReceived": m.get("donationsReceived", 0),
                    "trophies": m.get("trophies", 0),
                }
                for m in members
            ],
        }
        self._path(clan_tag).write_text(
            json.dumps(snapshot, indent=2), encoding="utf-8"
        )
        return snapshot
