"use client";

import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Social sharing with auto-generated, editable copy. Networks that accept
 * prefilled text get the copy; link-only networks (LinkedIn, Facebook) get
 * the URL — the copy is on the clipboard for pasting.
 */
export function SocialShare({
  brand,
  score,
  delta,
  shareUrl,
}: {
  brand: string;
  score: number;
  delta: number | null;
  shareUrl: string | null;
}) {
  const [copy, setCopy] = useState(
    delta && delta > 0
      ? `We've been measuring how ChatGPT, Gemini and Perplexity talk about ${brand} — and moved our AI Visibility Score to ${score}/100 (▲ +${delta}). Turns out you can change what AI says about you, once you can see it. Have you checked yours?`
      : `We asked ChatGPT, Gemini and Perplexity what they tell buyers about ${brand}. AI already has an opinion about your brand — most teams have just never seen it. Ours scored ${score}/100. Worth checking where yours lands.`
  );
  const [copied, setCopied] = useState(false);

  const url = shareUrl ?? "";
  const text = url ? `${copy}\n\n${url}` : copy;

  const networks = [
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(copy)}${url ? `&url=${encodeURIComponent(url)}` : ""}` },
    { label: "Threads", href: `https://www.threads.net/intent/post?text=${encodeURIComponent(text)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(text)}` },
  ];

  const mailto = `mailto:?subject=${encodeURIComponent(`AI Visibility Report — ${brand}`)}&body=${encodeURIComponent(text)}`;

  async function copyText() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <textarea
        value={copy}
        onChange={(e) => setCopy(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-line-strong bg-surface p-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
        aria-label="Social post copy"
      />
      {!shareUrl && (
        <p className="mt-1.5 text-xs text-mid">
          Create a share link above so posts include a public report URL.
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={copyText}>
          {copied ? <Check className="h-3.5 w-3.5 text-good" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy text"}
        </Button>
        <a
          href={mailto}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:bg-hover"
        >
          <Mail className="h-3.5 w-3.5" /> Email
        </a>
        {networks.map((n) => (
          <a
            key={n.label}
            href={n.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={copyText}
            className="inline-flex h-8 items-center rounded-lg border border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:bg-hover"
          >
            {n.label}
          </a>
        ))}
      </div>
    </div>
  );
}
