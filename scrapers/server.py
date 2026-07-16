#!/usr/bin/env python3
"""FastAPI wrapper around the scraper — POST a prompt, get JSON back.

⚠️  Personal research only. Automating ChatGPT/Gemini web UIs violates their
Terms of Service; do not run this as a public/commercial data source.

Run:
    uvicorn server:app --host 127.0.0.1 --port 8100
    # or: python server.py

Call (async — a scrape takes minutes, far longer than any gateway timeout):
    curl -s -X POST http://127.0.0.1:8100/scan \\
      -H 'content-type: application/json' \\
      -d '{"engine":"chatgpt","prompts":["best CRM for startups"]}' | jq
    # -> {"job_id": "...", "status": "queued", "poll": "/scan/<job_id>"}
    curl -s http://127.0.0.1:8100/scan/<job_id> | jq   # until status is "done"

Log in first (interactive, once per engine) with the CLI:
    python scrape.py --engine chatgpt --login
"""

from __future__ import annotations

import asyncio
import logging
import sys
import time
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, field_validator

from engines import ENGINES
from runner import run_scrape

# Scrape progress goes to stdout via logging — cloud log collectors often
# drop or buffer bare stderr prints, which is where runner's default log goes.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("scraper")


class _HealthAccessFilter(logging.Filter):
    """Drop access-log lines for health probes — the platform and the Docker
    HEALTHCHECK poll every few seconds and drown out the real traffic."""

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return "/health" not in msg and '"GET / ' not in msg


logging.getLogger("uvicorn.access").addFilter(_HealthAccessFilter())

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


# In-memory job store. Jobs survive only as long as the process — fine for a
# single-container deployment; poll reasonably soon after submitting.
_jobs: dict[str, dict] = {}
_MAX_JOBS = 100


def _prune_jobs() -> None:
    while len(_jobs) > _MAX_JOBS:
        oldest = min(_jobs, key=lambda k: _jobs[k]["created_at"])
        del _jobs[oldest]


# Error fragments that mean the browser process died under us — on a small
# container that is almost always the OOM killer or an exhausted /dev/shm.
_CRASH_SIGNATURES = ("crash", "browser has been closed", "browser closed",
                     "out of memory", "oom", "sigkill", "page closed")
_CRASH_HINT = ("browser died mid-scrape — on small containers this is usually "
               "out-of-memory; give the container >=2GB RAM")


def _classify_failure(job: dict, error: str) -> None:
    """Mark the job failed and, when the error looks like a browser crash,
    attach and log a resource hint."""
    job["status"] = "failed"
    job["error"] = error
    low = error.lower()
    if any(sig in low for sig in _CRASH_SIGNATURES):
        job["hint"] = _CRASH_HINT
        logger.error("[job %s] %s", job["job_id"], _CRASH_HINT)


async def _run_job(job_id: str, req: ScanRequest, prompts: list[str]) -> None:
    job = _jobs[job_id]
    async with _scrape_lock:
        job["status"] = "running"
        logger.info("[job %s] scan started: engine=%s prompts=%d timeout=%ds",
                    job_id, req.engine, len(prompts), req.timeout)
        try:
            # Playwright sync API needs a thread with no running event loop —
            # run_in_threadpool gives exactly that.
            outcome = await run_in_threadpool(
                run_scrape,
                req.engine,
                prompts,
                timeout=req.timeout,
                headless=req.headless,
                on_log=lambda msg: logger.info("[job %s] %s", job_id, msg),
            )
            job["result"] = outcome.to_dict()
            if outcome.ok:
                job["status"] = "done"
                logger.info("[job %s] scan finished: ok=True", job_id)
            else:
                # run_scrape never raises — session/prompt failures come back
                # inside the outcome, so surface them as a failed job.
                per_prompt = [r.error for r in outcome.results if r.error]
                error = outcome.error or (per_prompt[0] if per_prompt else "no answers collected")
                _classify_failure(job, error)
                logger.error("[job %s] scan failed: %s", job_id, error)
        except Exception as e:  # noqa: BLE001 — a crashed job must still report
            _classify_failure(job, str(e))
            logger.exception("[job %s] scan crashed", job_id)


@app.post("/scan")
async def scan(req: ScanRequest) -> dict:
    """Queue one scrape and return immediately — a scrape takes minutes, which
    no HTTP gateway tolerates. Jobs run one at a time (see _scrape_lock);
    poll GET /scan/{job_id} for the result."""
    prompts = req.prompt_list()
    if not prompts:
        raise HTTPException(status_code=400, detail="provide 'prompt' or 'prompts'")

    job_id = uuid.uuid4().hex[:12]
    _jobs[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "engine": req.engine,
        "prompts": prompts,
        "created_at": time.time(),
        "result": None,
        "error": None,
        "hint": None,
    }
    _prune_jobs()
    asyncio.create_task(_run_job(job_id, req, prompts))
    logger.info("[job %s] queued: engine=%s prompts=%d", job_id, req.engine, len(prompts))
    return {"job_id": job_id, "status": "queued", "poll": f"/scan/{job_id}"}


@app.get("/scan/{job_id}")
async def scan_status(job_id: str) -> dict:
    job = _jobs.get(job_id)
    if job is None:
        # Jobs live in memory only — a missing id right after submitting one
        # usually means the container restarted (OOM-killed mid-scrape).
        raise HTTPException(
            status_code=404,
            detail="unknown job_id — if you just submitted it, the server "
                   "likely restarted (check runtime logs for a boot marker; "
                   "a restart mid-scrape usually means out-of-memory)",
        )
    return job


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8100)
