#!/usr/bin/env python3
"""Experimental AI web-UI scraper (CLI) — drives the user's own logged-in
browser session to submit a prompt and read the rendered answer.

⚠️  Personal research only. Automating ChatGPT/Gemini web UIs violates their
Terms of Service; do not use as a data source for a production/commercial
product. No anti-bot evasion is implemented — a human solves any login or
challenge in the visible window.

Usage:
    python scrape.py --engine chatgpt --login
    python scrape.py --engine chatgpt --prompt "best CRM for startups"
    python scrape.py --engine gemini  --prompts-file prompts.txt --out out.json
"""

from __future__ import annotations

import argparse
import json
import sys

from runner import run_scrape, wait_for_login
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

    if args.login:
        wait_for_login(args.engine, headless=args.headless)
        return 0

    prompts = read_prompts(args)
    if not prompts:
        ap.error("provide --prompt, --prompts-file, or --login")

    outcome = run_scrape(
        args.engine, prompts, timeout=args.timeout, headless=args.headless, on_log=log
    )
    write_output(outcome.results, args)
    return 0 if outcome.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
