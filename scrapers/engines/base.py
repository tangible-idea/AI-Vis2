"""Base engine: drives the user's own logged-in browser session to submit
one prompt and read the rendered answer.

Robustness patterns are ported from OneGlanse's open-source agent (MIT):
provider lifecycle hooks that dismiss the auth modal at every step, a
dialog-scoped auth-modal dismissal, human-like typing/clicking cadence, and a
stability-based completion wait. Deliberately NOT ported: the Camoufox stealth
browser and residential-proxy rotation (anti-bot evasion) — a human still
solves any hard login/challenge in the visible window.
"""

from __future__ import annotations

import random
import re
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path

from playwright.sync_api import Locator, Page, TimeoutError as PWTimeout


USERDATA_ROOT = Path(__file__).resolve().parent.parent / ".userdata"


# ── human-like input helpers (ported from OneGlanse humanBehavior) ──────────

def _rand(lo: int, hi: int) -> int:
    return random.randint(lo, hi)


def move_mouse_to(page: Page, target: Locator) -> None:
    """Glide the cursor to an element along a jittered path, so the click
    doesn't look like an instantaneous teleport."""
    try:
        box = target.bounding_box()
    except Exception:  # noqa: BLE001
        box = None
    if not box:
        return
    vp = page.viewport_size or {"width": 1280, "height": 900}
    sx, sy = _rand(int(vp["width"] * 0.1), int(vp["width"] * 0.9)), _rand(
        int(vp["height"] * 0.1), int(vp["height"] * 0.9)
    )
    ex = box["x"] + box["width"] * (0.3 + random.random() * 0.4)
    ey = box["y"] + box["height"] * (0.3 + random.random() * 0.4)
    steps = _rand(6, 12)
    for i in range(steps + 1):
        t = i / steps
        x = sx + (ex - sx) * t
        y = sy + (ey - sy) * t
        try:
            page.mouse.move(x, y)
        except Exception:  # noqa: BLE001
            return
        page.wait_for_timeout(_rand(3, 12))


def click_like_user(page: Page, target: Locator, timeout: int = 5000) -> bool:
    """Move to the element then click it with a small press delay."""
    move_mouse_to(page, target)
    try:
        target.click(timeout=timeout, delay=_rand(40, 120))
        return True
    except Exception:  # noqa: BLE001
        return False


def type_like_user(page: Page, text: str) -> None:
    """Type in short chunks with irregular pauses (and Shift+Enter for
    newlines) so input doesn't land as one DOM burst."""
    segments = list(text)
    cursor = 0
    since_pause = 0
    while cursor < len(segments):
        size = _rand(3, 8)
        chunk = "".join(segments[cursor : cursor + size])
        cursor += size
        for ch in chunk:
            if ch == "\n":
                page.keyboard.press("Shift+Enter")
                since_pause = 0
                page.wait_for_timeout(_rand(60, 140))
            else:
                page.keyboard.type(ch)
                page.wait_for_timeout(_rand(12, 28))
                since_pause += 1
        page.wait_for_timeout(_rand(35, 110))
        if since_pause >= _rand(22, 40):
            since_pause = 0
            page.wait_for_timeout(_rand(120, 260))


@dataclass
class AnswerResult:
    engine: str
    prompt: str
    answer: str
    ok: bool
    error: str | None = None
    elapsed_s: float = 0.0
    # cited sources pulled from the UI's sources panel: [{url, title, cited_text}]
    sources: list[dict] = field(default_factory=list)
    meta: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


# full-page bot/challenge/login-wall signals (NOT the dismissable modal) —
# when these show, no clicking helps: a human must solve it or you must log in.
CHALLENGE_SIGNS = [
    "just a moment",
    "verifying you are human",
    "attention required",
    "checking your browser",
    "enable javascript and cookies",
    "unusual activity",
]


class Engine:
    """One consumer AI surface. Subclasses declare the URL + selectors and
    how to type/submit; the lifecycle, dismissal and completion wait are
    shared."""

    name: str = "base"
    url: str = ""
    # subclasses override these
    input_selector: str = ""
    answer_selector: str = ""  # matches every assistant turn; last one is current
    # the "stop generating" control is present only while streaming
    streaming_selector: str = ""

    # ── auth-modal dismissal (OneGlanse dialog-scoped pattern) ──────────
    # Scope the click to the specific modal (role=dialog + text) and click the
    # dismiss control *within* it, rather than a global text search.
    auth_dialog_selector: str = ""  # e.g. '[role="dialog"][data-state="open"]'
    auth_dialog_text: str = ""      # regex matched against the dialog text
    auth_dismiss_text: str = ""     # exact text of the "keep going" control
    # extra best-effort global fallbacks (older/localized variants)
    dismiss_selectors: list[str] = []

    # send button, tried if pressing Enter doesn't submit
    send_button_selector: str = ""
    # JS (an arrow function body) run in the page to pull cited sources from
    # the sources panel; returns [{rawHref, title, citedText}]. "" = none.
    raw_sources_js: str = ""
    # selector for the "Sources" toggle, if the provider hides sources behind it
    sources_button_selector: str = ""

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

    def reset(self) -> None:
        """Return to a clean composer (a fresh conversation) so each prompt is
        independent — mirrors OneGlanse resetProviderPage. Best-effort."""
        try:
            self.page.goto(self.url, wait_until="domcontentloaded")
            self.page.wait_for_timeout(_rand(1200, 2600))
            self.dismiss_popups()
        except Exception:  # noqa: BLE001
            pass

    def detect_challenge(self) -> str | None:
        """Return a reason if a full-page bot/challenge/login wall is showing
        (not the dismissable modal), else None. Lets callers fail fast with a
        clear message instead of hanging."""
        try:
            body = (self.page.inner_text("body", timeout=3000) or "").lower()
        except Exception:  # noqa: BLE001
            return None
        for sign in CHALLENGE_SIGNS:
            if sign in body:
                return f"challenge/bot page detected ({sign!r}) — solve it in the window or log in"
        return None

    # ── auth-modal / popup dismissal ─────────────────────────
    def dismiss_popups(self) -> bool:
        """Clear any known interstitial popup. Scoped auth-modal first, then
        best-effort global fallbacks. Silent and safe — the no-popup case is
        normal, so nothing here ever raises."""
        dismissed = self._dismiss_auth_modal()
        for sel in self.dismiss_selectors:
            try:
                loc = self.page.locator(sel).first
                if loc.is_visible():
                    if click_like_user(self.page, loc, timeout=2500):
                        dismissed = True
            except Exception:  # noqa: BLE001
                continue
        return dismissed

    def _dismiss_auth_modal(self) -> bool:
        if not self.auth_dialog_selector or not self.auth_dismiss_text:
            return False
        try:
            dialog = self.page.locator(self.auth_dialog_selector)
            if self.auth_dialog_text:
                dialog = dialog.filter(has_text=re.compile(self.auth_dialog_text, re.I))
            dialog = dialog.first
            if not dialog.is_visible():
                return False
            target = dialog.get_by_text(
                re.compile(rf"^{re.escape(self.auth_dismiss_text)}$", re.I)
            ).first
            if not target.is_visible():
                return False
            if click_like_user(self.page, target, timeout=5000):
                dialog.wait_for(state="hidden", timeout=5000)
                self.page.wait_for_timeout(300)
                return True
        except Exception:  # noqa: BLE001 — modal vanished or selector drifted
            return False
        return False

    # ── per-provider lifecycle hooks (override as needed) ────
    # Default: dismiss the auth modal at each step, mirroring OneGlanse's
    # beforePrompt/afterTyping/beforeSubmit/afterSubmit hooks.
    def before_prompt(self) -> None:
        self.dismiss_popups()

    def after_typing(self) -> None:
        self.dismiss_popups()

    def before_submit(self) -> None:
        self.dismiss_popups()

    def after_submit(self) -> None:
        self.dismiss_popups()

    def wait_for_ready(self, patient: bool = True) -> bool:
        """True once the prompt box is present (i.e. logged in, past any
        challenge). `patient` gives the human time to log in / solve."""
        deadline = time.time() + (300 if patient else 20)
        while time.time() < deadline:
            self.dismiss_popups()  # a nudge can sit on top of the composer
            try:
                if self.page.locator(self.input_selector).first.is_visible():
                    return True
            except PWTimeout:
                pass
            time.sleep(1.5)
        return False

    # ── typing + submit ──────────────────────────────────────
    def type_prompt(self, prompt: str) -> None:
        """Focus the composer and type with human cadence. Override if a
        surface needs special handling."""
        box = self.page.locator(self.input_selector).first
        click_like_user(self.page, box, timeout=5000)
        type_like_user(self.page, prompt)

    def submit(self) -> None:
        """Send the typed prompt: press Enter, and if the composer still holds
        the text (Enter didn't fire), fall back to clicking the send button."""
        self.page.keyboard.press("Enter")
        if not self.send_button_selector:
            return
        self.page.wait_for_timeout(500)
        try:
            box = self.page.locator(self.input_selector).first
            leftover = (box.inner_text(timeout=1500) or "").strip()
            if leftover:  # Enter didn't submit — try the button
                btn = self.page.locator(self.send_button_selector).first
                if btn.is_visible():
                    click_like_user(self.page, btn, timeout=3000)
        except Exception:  # noqa: BLE001
            pass

    def _answer_count(self) -> int:
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
        try:
            self.page.screenshot(path=str(path), full_page=False)
        except Exception:  # noqa: BLE001
            pass

    # ── cited-source extraction (OneGlanse sources-panel pattern) ────────
    def _open_sources_panel(self) -> None:
        """Open the provider's sources panel if it's behind a toggle."""
        if not self.sources_button_selector:
            return
        try:
            btn = self.page.locator(self.sources_button_selector).first
            if btn.is_visible():
                btn.scroll_into_view_if_needed()
                click_like_user(self.page, btn, timeout=3000)
                self.page.wait_for_timeout(500)
        except Exception:  # noqa: BLE001
            pass

    def extract_sources(self) -> list[dict]:
        """Read cited sources from the rendered UI (real URLs + titles + cited
        text), not regex over the answer. Returns [] when unsupported."""
        if not self.raw_sources_js:
            return []
        self._open_sources_panel()
        try:
            raw = self.page.evaluate(self.raw_sources_js) or []
        except Exception:  # noqa: BLE001
            return []
        out: list[dict] = []
        seen: set[str] = set()
        for r in raw:
            href = (r.get("rawHref") or "").split("#")[0]
            if not href or href in seen:
                continue
            seen.add(href)
            domain = ""
            m = re.match(r"https?://([^/]+)", href)
            if m:
                domain = m.group(1).replace("www.", "").lower()
            out.append({
                "url": href,
                "domain": domain,
                "title": r.get("title") or "",
                "cited_text": r.get("citedText") or "",
            })
        return out[:20]

    def _finish(self, prompt: str, text: str, start: float, meta: dict | None = None) -> AnswerResult:
        return AnswerResult(
            self.name, prompt, text, True,
            elapsed_s=round(time.time() - start, 1),
            sources=self.extract_sources(),
            meta=meta or {},
        )

    def ask(self, prompt: str) -> AnswerResult:
        start = time.time()
        before = self._answer_count()

        # lifecycle: dismiss → type → dismiss → submit → dismiss
        try:
            self.before_prompt()
            self.type_prompt(prompt)
            self.after_typing()
            self.before_submit()
            self.submit()
            self.after_submit()
        except Exception as e:  # noqa: BLE001 — report, don't crash the batch
            return AnswerResult(self.name, prompt, "", False, f"submit failed: {e}")

        # wait for a NEW assistant turn to appear (nudge can fire post-submit)
        appear_deadline = time.time() + 30
        while time.time() < appear_deadline:
            self.dismiss_popups()
            if self._answer_count() > before:
                break
            time.sleep(1.0)
        else:
            # enrich with the real reason when a hard wall (not a modal) is up
            reason = self.detect_challenge() or "no response appeared"
            return AnswerResult(self.name, prompt, "", False, reason)

        return self._wait_for_finish(prompt, start)

    def _wait_for_finish(self, prompt: str, start: float) -> AnswerResult:
        """Completion wait (OneGlanse waitForFinish pattern): finished when the
        answer text has been stable AND no streaming indicator is visible; a
        long stable stretch force-exits so a stuck indicator can't hang us."""
        STABLE_MS = 1800
        FORCE_EXIT_MS = 20000
        last_text = ""
        last_change = time.time()
        seen = False
        hard_deadline = start + self.timeout

        while time.time() < hard_deadline:
            self.dismiss_popups()  # modal can reappear mid-stream
            text = self._current_answer_text()
            if text:
                seen = True
            if text != last_text:
                last_text = text
                last_change = time.time()
            stable_ms = (time.time() - last_change) * 1000

            if seen and stable_ms >= STABLE_MS and not self._is_streaming():
                return self._finish(prompt, last_text, start)
            if seen and stable_ms >= FORCE_EXIT_MS:
                return self._finish(prompt, last_text, start, meta={"force_exit": True})
            time.sleep(0.3)

        return AnswerResult(
            self.name, prompt, last_text, bool(last_text),
            error=None if last_text else "timeout with no text",
            elapsed_s=round(time.time() - start, 1),
            meta={"truncated": True},
        )
