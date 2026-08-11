import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import agent

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("agent.startup")

app = FastAPI(title="Agent Orchestration API", version="2.0.0")

_origins = [o.strip() for o in settings.cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent.router, prefix="/api")


def _mask(val: str) -> str:
    if not val:
        return "<EMPTY>"
    return val[:8] + "…" + val[-4:]


@app.on_event("startup")
async def _log_startup():
    log.info("=== agent-orchestration-demo backend starting ===")
    log.info("ANTHROPIC_API_KEY: %s", _mask(settings.anthropic_api_key))
    log.info("OPENAI_API_KEY:    %s", _mask(settings.openai_api_key))
    log.info("CORS_ORIGINS:      %s", settings.cors_origins)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
