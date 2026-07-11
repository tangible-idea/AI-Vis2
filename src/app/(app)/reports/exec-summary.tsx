"use client";

import { useState } from "react";
import { Check, Copy, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";

/** Streams a stakeholder-ready executive summary from the latest scan metrics. */
export function ExecSummary({ projectId, metrics }: { projectId: string; metrics: string }) {
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  async function generate() {
    setBusy(true);
    setError(null);
    setOutput("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          type: "exec_summary",
          language: "en",
          instructions: `Latest scan metrics:\n${metrics}`,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? t("generator.generationFailed"));
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setOutput(acc);
      }
    } catch {
      setError(t("generator.networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <Button variant="secondary" size="sm" onClick={generate} disabled={busy}>
        <FileText className="h-3.5 w-3.5" />
        {busy ? t("generator.writing") : output ? t("generator.regenerate") : t("generator.generateExecSummary")}
      </Button>
      {error && <p className="mt-2 text-xs text-poor">{error}</p>}
      {(output || busy) && (
        <div className="mt-3">
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-paper p-4 font-sans text-[13px] leading-relaxed text-ink">
            {output || "…"}
          </pre>
          {!busy && output && (
            <Button variant="secondary" size="sm" className="mt-2" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5 text-good" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t("common.copied") : t("common.copy")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
