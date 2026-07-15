#!/usr/bin/env python3
"""Experimental AI web-UI scraper — drives the user's own logged-in browser
session to submit a prompt and read the rendered answer.

⚠️  Personal research only. Automating ChatGPT/Gemini web UIs violates their
Terms of Service; do not use as a data source for a production/commercial
product. No anti-bot evasion is implemented — a human solves any login or
challenge in the visible window.

Usage:
    python scrape.py --engine chatgpt --login
    python scrape.py --engine chatgpt --prompt "best CRM for startups"
    python scrape.py --engine gemini  --prompts-file prompts.txt --json
"""

from __future__ import annotations

import argparse
import json
import sys
import time

from playwright.sync_api import sync_playwright

from engines import get_engine
from engines.base import AnswerResult


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def read_prompts(args) -> list[str]:
    if args.prompt:
        return [args.prompt]
    if args.prompts_file:
        with open(args.prompts_file, encoding="utf-8") as f:
            return [line.strip() for line in f if line.strip()]
    return []


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--engine", required=True, help="chatgpt | gemini")
    ap.add_argument("--prompt", help="a single question")
    ap.add_argument("--prompts-file", help="path to a file with one question per line")
    ap.add_argument("--login", action="store_true", help="open the browser to log in, then save the session")
    ap.add_argument("--json", action="store_true", help="emit results as JSON")
    ap.add_argument("--out", help="write results to this file directly (survives crashes; recommended over shell redirect)")
    ap.add_argument("--headless", action="store_true", help="hide the window (not recommended)")
    ap.add_argument("--timeout", type=int, default=120, help="max seconds to wait for one answer")
    args = ap.parse_args()

    engine_cls = get_engine(args.engine)
    prompts = read_prompts(args)

    if not args.login and not prompts:
        ap.error("provide --prompt, --prompts-file, or --login")

    results: list[AnswerResult] = []
    debug_dir = engine_cls.profile_dir().parent / "debug"

    # Whatever happens — clean finish, stale selector, or crash mid-run —
    # the collected results are written out. An empty out.json almost always
    # means the process died before this ran; try/finally fixes exactly that.
    try:
        with sync_playwright() as p:
            # persistent context = the user's real profile & login, kept between
            # runs. Uses the user's own session; does not bypass authentication.
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(engine_cls.profile_dir()),
                headless=args.headless,
                viewport={"width": 1280, "height": 900},
                args=["--disable-blink-features=AutomationControlled"],
            )
            page = context.pages[0] if context.pages else context.new_page()
            engine = engine_cls(page, timeout=args.timeout)
            engine.open()

            if args.login:
                log(f"[{engine.name}] Log in / clear any challenge in the browser window.")
                log("[login] When the chat is ready, press Enter here to save the session…")
                try:
                    input()
                except EOFError:
                    time.sleep(60)
                context.close()
                log("[login] Session saved.")
                return 0

            # need a ready composer (logged in, past any challenge) before asking
            if not engine.wait_for_ready(patient=True):
                log(f"[{engine.name}] prompt box never appeared — log in with --login first.")
                debug_dir.mkdir(parents=True, exist_ok=True)
                engine.screenshot(debug_dir / f"{engine.name}-not-ready.png")
                context.close()
                return 2

            for i, prompt in enumerate(prompts, 1):
                log(f"[{engine.name}] ({i}/{len(prompts)}) asking: {prompt!r}")
                try:
                    res = engine.ask(prompt)
                except Exception as e:  # noqa: BLE001 — one bad prompt shouldn't lose the rest
                    res = AnswerResult(engine.name, prompt, "", False, f"ask crashed: {e}")
                status = "ok" if res.ok else f"FAILED ({res.error})"
                log(f"[{engine.name}] -> {status} in {res.elapsed_s}s, {len(res.answer)} chars")
                # empty answer usually means a stale selector — leave a screenshot
                if not res.answer:
                    debug_dir.mkdir(parents=True, exist_ok=True)
                    shot = debug_dir / f"{engine.name}-{i}-empty.png"
                    engine.screenshot(shot)
                    log(f"[{engine.name}] saved debug screenshot: {shot}")
                results.append(res)
                if i < len(prompts):
                    time.sleep(3)  # human-paced; do not hammer the surface

            context.close()
    finally:
        write_output(results, args)

    return 0 if results and all(r.ok for r in results) else 1


def write_output(results: list[AnswerResult], args) -> None:
    """Emit results to --out and/or stdout. Always runs, even on crash."""
    if args.json or args.out:
        payload = json.dumps([r.to_dict() for r in results], ensure_ascii=False, indent=2)
        if args.out:
            with open(args.out, "w", encoding="utf-8") as f:
                f.write(payload + "\n")
            log(f"[out] wrote {len(results)} result(s) to {args.out}")
        if args.json:
            print(payload)
    else:
        for r in results:
            print("=" * 70)
            print(f"# {r.engine} · {'OK' if r.ok else 'FAILED'} · {r.elapsed_s}s")
            print(f"Q: {r.prompt}")
            print("-" * 70)
            print(r.answer or f"(no answer — {r.error})")
            print()
        if not results:
            print("(no results — see stderr log above)")


if __name__ == "__main__":
    raise SystemExit(main())
