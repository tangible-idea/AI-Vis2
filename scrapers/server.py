#!/usr/bin/env python3
"""FastAPI wrapper around the scraper — POST a prompt, get JSON back.

⚠️  Personal research only. Automating ChatGPT/Gemini web UIs violates their
Terms of Service; do not run this as a public/commercial data source.

Run:
    uvicorn server:app --host 127.0.0.1 --port 8100
    # or: python server.py

Call:
    curl -s -X POST http://127.0.0.1:8100/scan \\
      -H 'content-type: application/json' \\
      -d '{"engine":"chatgpt","prompts":["best CRM for startups"]}' | jq

Log in first (interactive, once per engine) with the CLI:
    python scrape.py --engine chatgpt --login
"""

from __future__ import annotations

import asyncio

from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, field_validator

from engines import ENGINES
from runner import run_scrape

app = FastAPI(title="AI Visibility Scraper", version="0.1.0")

# One scrape at a time: the persistent browser profile can't be shared across
# concurrent sessions, and human-paced sequential access is the whole premise.
# Requests queue on this lock rather than colliding.
_scrape_lock = asyncio.Lock()


class ScanRequest(BaseModel):
    engine: str = Field(..., description="chatgpt | gemini")
    prompt: str | None = Field(None, description="a single question")
    prompts: list[str] | None = Field(None, description="several questions")
    timeout: int = Field(120, ge=10, le=600, description="max seconds per answer")
    headless: bool = Field(False, description="hide the browser window (not recommended)")

    @field_validator("engine")
    @classmethod
    def _known_engine(cls, v: str) -> str:
        if v not in ENGINES:
            raise ValueError(f"unknown engine '{v}' — choose from {', '.join(ENGINES)}")
        return v

    def prompt_list(self) -> list[str]:
        items = list(self.prompts or [])
        if self.prompt:
            items.insert(0, self.prompt)
        return [p.strip() for p in items if p and p.strip()]


@app.get("/")
@app.get("/health")
async def health() -> dict:
    return {"ok": True, "engines": list(ENGINES), "busy": _scrape_lock.locked()}


@app.post("/scan")
async def scan(req: ScanRequest) -> dict:
    """Run one scrape and return its JSON. Serialized: if a scrape is already
    running, this awaits the lock before starting (no concurrent sessions)."""
    prompts = req.prompt_list()
    if not prompts:
        return {"engine": req.engine, "ready": False, "ok": False,
                "error": "provide 'prompt' or 'prompts'", "results": []}

    async with _scrape_lock:
        # Playwright sync API needs a thread with no running event loop —
        # run_in_threadpool gives exactly that.
        outcome = await run_in_threadpool(
            run_scrape,
            req.engine,
            prompts,
            timeout=req.timeout,
            headless=req.headless,
        )
    return outcome.to_dict()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8100)
