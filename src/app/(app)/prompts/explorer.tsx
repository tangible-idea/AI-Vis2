"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Pause, Play, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Badge, Button, Card, CardHeader, Input } from "@/components/ui";
import { PROMPT_CATEGORIES, type Prompt, type PromptCategory } from "@/lib/types";
import { togglePrompt, removePrompt } from "../settings/actions";
import { addPrompts, type PromptDraft } from "./actions";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

interface Suggestion extends PromptDraft {
  accepted: boolean;
}

function categoryLabel(category: PromptCategory) {
  return PROMPT_CATEGORIES.find((c) => c.id === category)?.label ?? category;
}

/**
 * Prompt Explorer — the primary interface for prompt management. Prompts
 * are organized into user-defined Topics; entering a topic generates
 * recommended prompts which stay drafts until accepted.
 */
export function PromptExplorer({
  projectId,
  prompts,
  maxPrompts,
}: {
  projectId: string;
  prompts: Prompt[];
  maxPrompts: number;
}) {
  const t = useT();
  const [topic, setTopic] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [suggestedFor, setSuggestedFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: "good" | "poor"; text: string } | null>(null);
  const [manualText, setManualText] = useState("");
  const [, startRow] = useTransition();
  const [saving, startSave] = useTransition();

  const activeCount = prompts.filter((p) => p.is_active).length;
  const atLimit = activeCount >= maxPrompts;

  // library grouped by topic; untopiced prompts fall into one general group
  const groups = new Map<string, Prompt[]>();
  for (const p of prompts) {
    const key = p.topic?.trim() || t("promptExplorer.generalGroup");
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  async function suggest() {
    const q = topic.trim();
    if (!q || loading) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/prompts/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, topic: q }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ tone: "poor", text: data.error ?? t("promptExplorer.suggestError") });
      } else if (!data.suggestions?.length) {
        setNotice({ tone: "poor", text: t("promptExplorer.noSuggestions") });
      } else {
        setSuggestions(
          (data.suggestions as PromptDraft[]).map((s) => ({ ...s, accepted: true }))
        );
        setSuggestedFor(q);
      }
    } catch {
      setNotice({ tone: "poor", text: t("promptExplorer.suggestError") });
    }
    setLoading(false);
  }

  function saveAccepted() {
    const accepted = (suggestions ?? []).filter((s) => s.accepted && s.text.trim());
    if (!accepted.length) return;
    startSave(async () => {
      const res = await addPrompts(
        projectId,
        suggestedFor,
        accepted.map(({ text, category }) => ({ text, category }))
      );
      if (res.error) {
        setNotice({ tone: "poor", text: res.error });
      } else {
        setNotice({
          tone: "good",
          text: t("promptExplorer.saved", { count: res.added }),
        });
        setSuggestions(null);
        setTopic("");
      }
    });
  }

  function addManual() {
    const text = manualText.trim();
    if (!text) return;
    startSave(async () => {
      const res = await addPrompts(projectId, null, [{ text, category: "custom" }]);
      if (res.error) setNotice({ tone: "poor", text: res.error });
      else if (res.added === 0)
        setNotice({ tone: "poor", text: t("promptExplorer.duplicate") });
      else {
        setNotice(null);
        setManualText("");
      }
    });
  }

  return (
    <div className="stagger space-y-4">
      {/* topic → recommended prompts */}
      <Card>
        <CardHeader title={t("promptExplorer.topicTitle")} hint={t("promptExplorer.topicHint")} />
        <div className="space-y-4 px-5 pb-5">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              suggest();
            }}
          >
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t("promptExplorer.topicPlaceholder")}
              aria-label={t("promptExplorer.topicTitle")}
              className="max-w-sm"
            />
            <Button type="submit" variant="secondary" size="sm" className="h-9.5" disabled={loading || !topic.trim()}>
              <Sparkles className="h-3.5 w-3.5" />
              {loading ? t("promptExplorer.generating") : t("promptExplorer.generate")}
            </Button>
          </form>

          {suggestions && (
            <div className="space-y-2 rounded-lg bg-hover/50 p-3">
              <p className="text-xs font-medium text-ink-soft">
                {t("promptExplorer.reviewHint", { topic: suggestedFor })}
              </p>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border border-line bg-paper px-2.5 py-1.5",
                    !s.accepted && "opacity-45"
                  )}
                >
                  <button
                    onClick={() =>
                      setSuggestions((prev) =>
                        prev!.map((x, j) => (j === i ? { ...x, accepted: !x.accepted } : x))
                      )
                    }
                    aria-label={s.accepted ? t("promptExplorer.reject") : t("promptExplorer.accept")}
                    title={s.accepted ? t("promptExplorer.reject") : t("promptExplorer.accept")}
                    className={cn(
                      "flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border",
                      s.accepted
                        ? "border-accent bg-accent-soft text-accent-strong"
                        : "border-line-strong text-ink-faint"
                    )}
                  >
                    {s.accepted ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </button>
                  <input
                    value={s.text}
                    onChange={(e) =>
                      setSuggestions((prev) =>
                        prev!.map((x, j) => (j === i ? { ...x, text: e.target.value } : x))
                      )
                    }
                    aria-label={t("promptExplorer.editPrompt")}
                    className="min-w-0 flex-1 bg-transparent text-sm text-ink focus:outline-none"
                  />
                  <Badge tone="neutral">{categoryLabel(s.category)}</Badge>
                </div>
              ))}
              <div className="flex items-center gap-3 pt-1">
                <Button size="sm" onClick={saveAccepted} disabled={saving || !suggestions.some((s) => s.accepted)}>
                  <Plus className="h-3.5 w-3.5" />
                  {saving
                    ? t("promptExplorer.saving")
                    : t("promptExplorer.addAccepted", {
                        count: suggestions.filter((s) => s.accepted).length,
                      })}
                </Button>
                <button
                  onClick={() => setSuggestions(null)}
                  className="cursor-pointer text-xs text-ink-faint hover:text-ink"
                >
                  {t("promptExplorer.discard")}
                </button>
              </div>
            </div>
          )}

          {notice && (
            <p className={cn("text-xs", notice.tone === "good" ? "text-good" : "text-poor")}>
              {notice.text}
            </p>
          )}
        </div>
      </Card>

      {/* manual add */}
      <Card>
        <CardHeader title={t("promptExplorer.manualTitle")} hint={t("promptExplorer.manualHint")} />
        <div className="space-y-3 px-5 pb-5">
          {atLimit ? (
            <p className="text-xs text-mid">
              {t("promptExplorer.limitReached", { max: maxPrompts })}{" "}
              <Link href="/billing" className="underline">
                {t("common.upgrade")}
              </Link>
            </p>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addManual();
              }}
            >
              <Input
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={t("promptExplorer.manualPlaceholder")}
                aria-label={t("promptExplorer.manualTitle")}
              />
              <Button type="submit" variant="secondary" size="sm" className="h-9.5" disabled={saving || !manualText.trim()}>
                {t("common.add")}
              </Button>
            </form>
          )}
        </div>
      </Card>

      {/* library grouped by topic */}
      {[...groups.entries()].map(([groupName, rows]) => (
        <Card key={groupName}>
          <CardHeader
            title={groupName}
            hint={t("promptExplorer.groupHint", {
              active: rows.filter((p) => p.is_active).length,
              total: rows.length,
            })}
          />
          <div className="divide-y divide-line px-5 pb-4">
            {rows.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5">
                <span
                  className={cn(
                    "flex-1 text-sm",
                    p.is_active ? "text-ink" : "text-ink-faint line-through"
                  )}
                >
                  {p.text}
                </span>
                <Badge tone={p.is_active ? "neutral" : "mid"}>
                  {p.is_active ? categoryLabel(p.category) : t("promptExplorer.paused")}
                </Badge>
                <button
                  onClick={() => startRow(() => togglePrompt(p.id, !p.is_active))}
                  aria-label={p.is_active ? t("promptExplorer.pause") : t("promptExplorer.resume")}
                  title={p.is_active ? t("promptExplorer.pause") : t("promptExplorer.resume")}
                  className="cursor-pointer rounded p-1 text-ink-faint hover:bg-hover hover:text-ink"
                >
                  {p.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => startRow(() => removePrompt(p.id))}
                  aria-label={t("promptExplorer.delete")}
                  title={t("promptExplorer.delete")}
                  className="cursor-pointer rounded p-1 text-ink-faint hover:bg-poor-soft hover:text-poor"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
