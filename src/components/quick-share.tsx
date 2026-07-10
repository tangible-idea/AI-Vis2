"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Download, Mail, Share2 } from "lucide-react";

/**
 * One-click sharing row for the Last Scan Summary. Copy uses the newest
 * public share link when one exists; otherwise it routes to Reports where
 * links are created (and gated by plan).
 */
export function QuickShare({
  shareUrl,
  brand,
  score,
  delta,
}: {
  shareUrl: string | null;
  brand: string;
  score: number;
  delta: number | null;
}) {
  const [copied, setCopied] = useState(false);

  const summary = `${brand} AI Visibility Score: ${score}/100${
    delta && delta > 0 ? ` (▲ +${delta} since last scan)` : ""
  }`;
  const mailto = `mailto:?subject=${encodeURIComponent(`AI Visibility Report — ${brand}`)}&body=${encodeURIComponent(
    `${summary}\n\n${shareUrl ? `Full report: ${shareUrl}` : "Full report attached."}`
  )}`;

  async function copy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const btn =
    "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-[11px] font-medium text-ink hover:bg-hover";

  return (
    <div className="flex flex-wrap gap-1.5">
      {shareUrl ? (
        <button onClick={copy} className={btn}>
          {copied ? <Check className="h-3 w-3 text-good" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy public link"}
        </button>
      ) : (
        <Link href="/reports" className={btn}>
          <Copy className="h-3 w-3" /> Copy public link
        </Link>
      )}
      <a href={mailto} className={btn}>
        <Mail className="h-3 w-3" /> Email report
      </a>
      <button onClick={() => window.print()} className={btn}>
        <Download className="h-3 w-3" /> Download PDF
      </button>
      <Link href="/reports" className={btn}>
        <Share2 className="h-3 w-3" /> Share
      </Link>
    </div>
  );
}
