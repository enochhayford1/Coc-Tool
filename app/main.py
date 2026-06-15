"""FastAPI application entry point.

Run with:  uvicorn app.main:app --reload
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import __version__
from .config import get_settings
from .routers import api

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="CoC Clan Tool", version=__version__)
app.include_router(api.router)
app.mount(
    "/static", StaticFiles(directory=BASE_DIR / "static"), name="static"
)

templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


@app.get("/", response_class=HTMLResponse)
async def index(request: Request) -> HTMLResponse:
    settings = get_settings()
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "version": __version__,
            "demo_mode": not settings.is_api_configured,
        },
    )
