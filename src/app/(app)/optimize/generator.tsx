"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Save, Wand2 } from "lucide-react";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { CONTENT_TYPES, type ContentType } from "@/lib/content/templates";
import { CONTENT_LANGUAGES } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ContentGenerator({
  projectId,
  initialType,
  recommendationId,
  initialInstructions,
}: {
  projectId: string;
  initialType?: ContentType;
  recommendationId?: string;
  initialInstructions?: string;
}) {
  const [type, setType] = useState<ContentType>(initialType ?? "faq_page");
  const [language, setLanguage] = useState("en");
  const [instructions, setInstructions] = useState(initialInstructions ?? "");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outRef = useRef<HTMLPreElement>(null);
  const router = useRouter();

  // follow "Generate X" clicks from the recommendation list
  useEffect(() => {
    if (initialType) setType(initialType);
  }, [initialType, recommendationId]);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    setOutput("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, type, language, instructions }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Generation failed");
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
        outRef.current?.scrollTo({ top: outRef.current.scrollHeight });
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const label = CONTENT_TYPES.find((t) => t.id === type)?.label ?? type;
    const res = await fetch("/api/generate/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        type,
        language,
        title: label,
        content: output,
        recommendationId,
      }),
    });
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <Label htmlFor="gen-type">What to generate</Label>
          <Select
            id="gen-type"
            value={type}
            onChange={(e) => setType(e.target.value as ContentType)}
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} — {t.blurb}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="gen-lang">Language</Label>
          <Select
            id="gen-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="sm:w-44"
          >
            {CONTENT_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <Button onClick={generate} disabled={busy}>
            <Wand2 className={cn("h-4 w-4", busy && "animate-pulse")} />
            {busy ? "Generating…" : "Generate"}
          </Button>
        </div>
      </div>
      <div className="mt-3">
        <Input
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Optional instructions — tone, focus keywords, specific pages…"
        />
      </div>

      {error && <p className="mt-3 text-sm text-poor">{error}</p>}

      {(output || busy) && (
        <div className="mt-4">
          <pre
            ref={outRef}
            className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-paper p-4 font-sans text-[13px] leading-relaxed text-ink"
          >
            {output || "…"}
          </pre>
          {!busy && output && (
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm" onClick={copy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="secondary" size="sm" onClick={save} disabled={saved}>
                {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                {saved ? "Saved to library" : "Save to library"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
