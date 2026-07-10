"use client";

import { useState } from "react";
import { Check, Copy, Download, Mail } from "lucide-react";

/** Export/share row for the monthly recap card. */
export function RecapActions({ brand, summary }: { brand: string; summary: string }) {
  const [copied, setCopied] = useState(false);

  const mailto = `mailto:?subject=${encodeURIComponent(`Monthly AI visibility recap — ${brand}`)}&body=${encodeURIComponent(summary)}`;

  async function copy() {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const btn =
    "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-[11px] font-medium text-ink hover:bg-hover";

  return (
    <div className="flex flex-wrap gap-1.5">
      <button onClick={() => window.print()} className={btn}>
        <Download className="h-3 w-3" /> Export PDF
      </button>
      <a href={mailto} className={btn}>
        <Mail className="h-3 w-3" /> Email summary
      </a>
      <button onClick={copy} className={btn}>
        {copied ? <Check className="h-3 w-3 text-good" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Share with team"}
      </button>
    </div>
  );
}
