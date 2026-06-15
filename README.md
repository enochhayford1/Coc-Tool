# CoC Clan Tool

A web dashboard for **Clash of Clans clan recruitment and management**, backed
by the official [Clash of Clans API](https://developer.clashofclans.com/).

It helps clan leaders and co-leaders:

- **Screen recruits** — look up a prospective member by tag and get a 0–100 fit
  score against your clan's requirements (Town Hall, trophies, war stars,
  donation ratio, war opt-in), with a clear strong / consider / weak verdict.
- **Manage members** — a roster ranked by a contribution score, with automatic
  flags for low donors and "receives but never donates", plus promotion
  candidates. Save periodic snapshots to surface inactivity via donation and
  trophy deltas.
- **Track war** — current war scoreboard with per-member attacks used and a
  clear list of who still has attacks left.
- **See donation & activity stats** — totals, averages, and per-member ratios.

The tool runs in **demo mode** with realistic sample data when no API token is
configured, so you can explore it immediately.

## Quick start

```bash
# 1. Install dependencies (Python 3.10+)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. (Optional) configure the official API for live data
cp .env.example .env
#   then edit .env and set COC_API_TOKEN and COC_CLAN_TAG

# 3. Run
uvicorn app.main:app --reload

# 4. Open http://127.0.0.1:8000
```

Without a token you'll see the **Demo Warriors** sample clan. On the
Recruitment tab in demo mode, click the `#GOOD` / `#OKAY` / `#WEAK` sample tags
to see scoring in action.

## Getting an API token

1. Sign in at <https://developer.clashofclans.com/>.
2. Create a new key and bind it to your server's **public IP address** (the API
   is IP-restricted). Run `curl https://api.ipify.org` on the host to find it.
3. Put the token in `.env` as `COC_API_TOKEN`, and your clan tag (including the
   leading `#`) as `COC_CLAN_TAG`.

The token stays server-side and is never exposed to the browser.

## Configuration

All settings live in `.env` (see `.env.example`). Recruitment thresholds and
the inactivity donation floor are adjustable there.

## Project layout

```
app/
  main.py          FastAPI app + dashboard page
  config.py        Settings (env / .env)
  coc_client.py    Async official-API client
  service.py       Live-vs-demo orchestration
  analysis.py      Pure logic: scoring, ranking, war stats  <- unit-tested
  store.py         JSON snapshot store (for activity deltas)
  models.py        Computed-response models
  demo_data.py     Sample data for demo mode
  routers/api.py   JSON endpoints
  templates/, static/   Frontend
tests/             Tests for the analysis layer
data/              Saved roster snapshots (git-ignored)
```

## API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Status, demo flag, configured requirements |
| GET | `/api/overview?clan=` | Clan summary + headline stats |
| GET | `/api/members?clan=` | Roster with contribution scores, flags, deltas |
| POST | `/api/snapshot?clan=` | Save a roster snapshot for delta tracking |
| GET | `/api/war?clan=` | Current war report |
| GET | `/api/recruit/{player_tag}` | Recruitment fit score for a player |

The optional `clan` query parameter overrides the default `COC_CLAN_TAG`.

## Notes & limitations

- The official API is **read-only**, so the tool reports and screens; it can't
  invite players or post recruitment ads on your behalf.
- There is no "last online" field in the API. Inactivity is inferred from
  donation/trophy changes between saved snapshots — save a snapshot regularly
  (e.g. via the button or a cron job hitting `POST /api/snapshot`) for this to
  be meaningful.
- War endpoints require the clan's war log to be public.

## Tests

```bash
pytest
```
