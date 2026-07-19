"""Gemini (gemini.google.com) surface.

Selectors reflect the UI as of mid-2026 and WILL drift — update here when
they break. Nothing in this file defeats bot detection; a human handles
any login/challenge in the visible window."""

from __future__ import annotations

from .base import Engine


class GeminiEngine(Engine):
    name = "gemini"
    url = "https://gemini.google.com/app"

    # Gemini's composer is a Quill contenteditable
    input_selector = "div.ql-editor[contenteditable='true']"
    # each model turn renders inside <message-content>; .last = current answer
    answer_selector = "message-content"
    # the stop control shows while streaming
    streaming_selector = "button[aria-label*='Stop'], .stop-icon"

    # Gemini uses the shared human-typing flow (type_prompt) + Enter to submit;
    # it has no persistent logged-out nudge, so no auth_dialog_* needed.
