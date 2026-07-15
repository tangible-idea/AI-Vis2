"""Base engine: drives the user's own logged-in browser session to submit
one prompt and read the rendered answer. No anti-bot evasion — a human
solves any login/challenge in the visible window."""

from __future__ import annotations

import time
from dataclasses import dataclass, field, asdict
from pathlib import Path

from playwright.sync_api import Page, TimeoutError as PWTimeout


USERDATA_ROOT = Path(__file__).resolve().parent.parent / ".userdata"


@dataclass
class AnswerResult:
    engine: str
    prompt: str
    answer: str
    ok: bool
    error: str | None = None
    elapsed_s: float = 0.0
    meta: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


class Engine:
    """One consumer AI surface. Subclasses declare the URL + selectors and
    how to type/submit; the streaming-completion wait is shared."""

    name: str = "base"
    url: str = ""
    # subclasses override these
    input_selector: str = ""
    answer_selector: str = ""  # matches every assistant turn; last one is current
    # the "stop generating" control is present only while streaming
    streaming_selector: str = ""

    def __init__(self, page: Page, timeout: int = 120):
        self.page = page
        self.timeout = timeout

    # ── lifecycle ────────────────────────────────────────────
    @classmethod
    def profile_dir(cls) -> Path:
        d = USERDATA_ROOT / cls.name
        d.mkdir(parents=True, exist_ok=True)
        return d

    def open(self) -> None:
        self.page.goto(self.url, wait_until="domcontentloaded")

    def wait_for_ready(self, patient: bool = True) -> bool:
        """True once the prompt box is present (i.e. logged in, past any
        challenge). `patient` gives the human time to log in / solve."""
        deadline = time.time() + (300 if patient else 20)
        while time.time() < deadline:
            try:
                if self.page.locator(self.input_selector).first.is_visible():
                    return True
            except PWTimeout:
                pass
            time.sleep(1.5)
        return False

    # ── the one thing we actually do ─────────────────────────
    def submit_prompt(self, prompt: str) -> None:
        """Type + send. Subclasses override if the surface needs it."""
        box = self.page.locator(self.input_selector).first
        box.click()
        box.fill(prompt)
        self.page.keyboard.press("Enter")

    def _answer_count(self) -> int:
        # DOM can be mid-mutation while streaming; a transient failure here
        # must never kill the run — treat it as "unknown, retry next tick"
        try:
            return self.page.locator(self.answer_selector).count()
        except Exception:  # noqa: BLE001
            return 0

    def _current_answer_text(self) -> str:
        try:
            loc = self.page.locator(self.answer_selector).last
            return (loc.inner_text(timeout=5000) or "").strip()
        except Exception:  # noqa: BLE001 — element may detach as React re-renders
            return ""

    def _is_streaming(self) -> bool:
        if not self.streaming_selector:
            return False
        try:
            return self.page.locator(self.streaming_selector).first.is_visible()
        except Exception:  # noqa: BLE001
            return False

    def screenshot(self, path) -> None:
        """Best-effort debug capture — used when an answer comes back empty
        so stale selectors are easy to spot."""
        try:
            self.page.screenshot(path=str(path), full_page=False)
        except Exception:  # noqa: BLE001
            pass

    def ask(self, prompt: str) -> AnswerResult:
        start = time.time()
        before = self._answer_count()
        try:
            self.submit_prompt(prompt)
        except Exception as e:  # noqa: BLE001 — report, don't crash the batch
            return AnswerResult(self.name, prompt, "", False, f"submit failed: {e}")

        # wait for a NEW assistant turn to appear
        appear_deadline = time.time() + 30
        while time.time() < appear_deadline:
            if self._answer_count() > before:
                break
            time.sleep(1.0)
        else:
            return AnswerResult(self.name, prompt, "", False, "no response appeared")

        # wait for streaming to finish: text stable for STABLE_S, or the
        # streaming control disappears, whichever comes first
        STABLE_S = 4.0
        last_text = ""
        last_change = time.time()
        hard_deadline = start + self.timeout
        while time.time() < hard_deadline:
            text = self._current_answer_text()
            if text != last_text:
                last_text = text
                last_change = time.time()
            settled = (time.time() - last_change) >= STABLE_S
            if last_text and settled and not self._is_streaming():
                return AnswerResult(
                    self.name, prompt, last_text, True,
                    elapsed_s=round(time.time() - start, 1),
                )
            time.sleep(1.0)

        # timed out mid-stream — return what we have, flagged
        return AnswerResult(
            self.name, prompt, last_text, bool(last_text),
            error=None if last_text else "timeout with no text",
            elapsed_s=round(time.time() - start, 1),
            meta={"truncated": True},
        )
