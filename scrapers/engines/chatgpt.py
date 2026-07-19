"""ChatGPT (chatgpt.com) surface.

Selectors reflect the UI as of mid-2026 and WILL drift — update here when
they break. Nothing in this file defeats bot detection; a human handles any
Cloudflare/hard-login wall in the visible window. The recurring "Thanks for
trying ChatGPT" nudge is dismissed at every lifecycle step (see base.Engine
hooks), mirroring OneGlanse's dismissChatgptAuthModal wiring."""

from __future__ import annotations

from .base import Engine


class ChatGPTEngine(Engine):
    name = "chatgpt"
    url = "https://chatgpt.com/"

    # the composer is a contenteditable div (id has been stable for a while)
    input_selector = "#prompt-textarea"
    # every assistant turn carries this data attribute; .last = current answer
    answer_selector = '[data-message-author-role="assistant"]'
    # visible only while a response is streaming
    streaming_selector = 'button[data-testid="stop-button"], button[aria-label*="Stop"]'

    # dialog-scoped auth modal: match the specific "log in" nudge and click
    # "Stay logged out" *inside* it (OneGlanse pattern), not a global search.
    auth_dialog_selector = '[role="dialog"][data-state="open"]'
    auth_dialog_text = r"Thanks for trying ChatGPT|Log in or sign up"
    auth_dismiss_text = "Stay logged out"
    # localized / older fallbacks, tried only if the scoped path misses
    dismiss_selectors = [
        'button:has-text("Stay logged out")',
        'text="로그아웃 상태 유지"',
    ]

    # send button fallback when Enter doesn't submit
    send_button_selector = 'button[data-testid="send-button"], button[aria-label*="Send"]'

    # cited sources live behind a "Sources" toggle
    sources_button_selector = 'button:has-text("Sources"), [aria-label*="Sources"]'
    # DOM extractor ported verbatim from OneGlanse chatgpt/lib/extractSources.ts —
    # reads the sources-panel anchors → {rawHref, title, citedText}.
    raw_sources_js = r"""() => {
      const results = [];
      const getLeafTexts = (anchor) => {
        const texts = [];
        for (const el of anchor.querySelectorAll("*")) {
          const text = (el.textContent || "").trim();
          if (!text) continue;
          if (Array.from(el.children).some((c) => (c.textContent || "").trim().length > 0)) continue;
          texts.push(text);
        }
        return Array.from(new Set(texts));
      };
      for (const anchor of Array.from(
        document.querySelectorAll('ul li > a[target="_blank"][rel*="noopener"][href^="http"]'),
      )) {
        if (!(anchor instanceof HTMLAnchorElement)) continue;
        const rawHref = anchor.href.replace(/#.*$/, "");
        if (!rawHref) continue;
        const texts = getLeafTexts(anchor);
        if (texts.length === 0) continue;
        const sorted = [...texts].sort((a, b) => a.length - b.length);
        const citedText = sorted[sorted.length - 1] || "";
        const title = sorted.length >= 2 ? sorted[sorted.length - 2] || "" : sorted[0] || "";
        results.push({ rawHref, title, citedText });
      }
      return results;
    }"""
