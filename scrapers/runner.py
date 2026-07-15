"""Shared scrape core used by both the CLI (scrape.py) and the API
(server.py). Owns the synchronous Playwright session so there's one source
of truth for how a scan runs.

Synchronous by design — Playwright's sync API must run in a thread without a
running asyncio loop. The FastAPI server calls run_scrape() inside a
threadpool worker, which satisfies that.
"""

from __future__ import annotations

import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from playwright.sync_api import sync_playwright

from engines import get_engine
from engines.base import AnswerResult


def _default_log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


@dataclass
class ScrapeOutcome:
    engine: str
    ready: bool  # composer appeared (logged in, past any challenge)
    results: list[AnswerResult] = field(default_factory=list)
    error: str | None = None

    @property
    def ok(self) -> bool:
        return self.ready and bool(self.results) and all(r.ok for r in self.results)

    def to_dict(self) -> dict:
        return {
            "engine": self.engine,
            "ready": self.ready,
            "ok": self.ok,
            "error": self.error,
            "results": [r.to_dict() for r in self.results],
        }


def run_scrape(
    engine_name: str,
    prompts: list[str],
    *,
    timeout: int = 120,
    headless: bool = False,
    pace_seconds: float = 3.0,
    debug: bool = True,
    on_log: Callable[[str], None] | None = None,
) -> ScrapeOutcome:
    """Open the user's persistent session, ask each prompt in turn, return
    the collected answers. Never raises for scrape-level failures — those are
    captured per prompt or in ScrapeOutcome.error."""
    log = on_log or _default_log
    engine_cls = get_engine(engine_name)
    debug_dir = engine_cls.profile_dir().parent / "debug"
    outcome = ScrapeOutcome(engine=engine_name, ready=False)

    try:
        with sync_playwright() as p:
            # persistent context = the user's real profile & login, kept
            # between runs. Uses the user's own session; no auth bypass.
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(engine_cls.profile_dir()),
                headless=headless,
                viewport={"width": 1280, "height": 900},
                args=["--disable-blink-features=AutomationControlled"],
            )
            try:
                page = context.pages[0] if context.pages else context.new_page()
                engine = engine_cls(page, timeout=timeout)
                engine.open()

                if not engine.wait_for_ready(patient=True):
                    outcome.error = "prompt box never appeared — run the CLI with --login first"
                    log(f"[{engine_name}] {outcome.error}")
                    if debug:
                        debug_dir.mkdir(parents=True, exist_ok=True)
                        engine.screenshot(debug_dir / f"{engine_name}-not-ready.png")
                    return outcome
                outcome.ready = True

                for i, prompt in enumerate(prompts, 1):
                    log(f"[{engine_name}] ({i}/{len(prompts)}) asking: {prompt!r}")
                    try:
                        res = engine.ask(prompt)
                    except Exception as e:  # noqa: BLE001 — one bad prompt shouldn't lose the rest
                        res = AnswerResult(engine_name, prompt, "", False, f"ask crashed: {e}")
                    status = "ok" if res.ok else f"FAILED ({res.error})"
                    log(f"[{engine_name}] -> {status} in {res.elapsed_s}s, {len(res.answer)} chars")
                    if debug and not res.answer:
                        debug_dir.mkdir(parents=True, exist_ok=True)
                        shot = debug_dir / f"{engine_name}-{i}-empty.png"
                        engine.screenshot(shot)
                        log(f"[{engine_name}] saved debug screenshot: {shot}")
                    outcome.results.append(res)
                    if i < len(prompts):
                        time.sleep(pace_seconds)  # human-paced; do not hammer the surface
            finally:
                context.close()
    except Exception as e:  # noqa: BLE001 — surface as data, never crash the caller
        outcome.error = outcome.error or f"session failed: {e}"
        log(f"[{engine_name}] {outcome.error}")

    return outcome


def wait_for_login(engine_name: str, headless: bool = False) -> bool:
    """Interactive helper for the CLI: open the session so the user can log
    in, then persist it. Returns True once the session is saved."""
    engine_cls = get_engine(engine_name)
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(engine_cls.profile_dir()),
            headless=headless,
            viewport={"width": 1280, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.pages[0] if context.pages else context.new_page()
        engine = engine_cls(page)
        engine.open()
        _default_log(f"[{engine_name}] Log in / clear any challenge in the browser window.")
        _default_log("[login] When the chat is ready, press Enter here to save the session…")
        try:
            input()
        except EOFError:
            time.sleep(60)
        context.close()
        _default_log("[login] Session saved.")
    return True
