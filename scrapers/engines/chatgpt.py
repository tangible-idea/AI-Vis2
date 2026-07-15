"""ChatGPT (chatgpt.com) surface.

Selectors reflect the UI as of mid-2026 and WILL drift — update here when
they break. Nothing in this file defeats bot detection; a human handles
any Cloudflare/login prompt in the visible window."""

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

    def submit_prompt(self, prompt: str) -> None:
        box = self.page.locator(self.input_selector).first
        box.click()
        # contenteditable: type so React registers input, then Enter to send
        box.type(prompt, delay=8)
        self.page.keyboard.press("Enter")
