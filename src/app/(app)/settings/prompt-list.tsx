"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { togglePrompt, removePrompt } from "./actions";
import { Badge } from "@/components/ui";
import { PROMPT_CATEGORIES, type Prompt } from "@/lib/types";

export function PromptRows({ prompts }: { prompts: Prompt[] }) {
  const [, start] = useTransition();
  return (
    <div className="divide-y divide-line">
      {prompts.map((p) => (
        <div key={p.id} className="flex items-center gap-3 py-2.5">
          <input
            type="checkbox"
            checked={p.is_active}
            onChange={(e) => start(() => togglePrompt(p.id, e.target.checked))}
            className="h-4 w-4 cursor-pointer accent-[#0e7b43]"
            aria-label={`Toggle prompt: ${p.text}`}
          />
          <span className={`flex-1 text-sm ${p.is_active ? "text-ink" : "text-ink-faint line-through"}`}>
            {p.text}
          </span>
          <Badge tone="neutral">
            {PROMPT_CATEGORIES.find((c) => c.id === p.category)?.label ?? p.category}
          </Badge>
          <button
            onClick={() => start(() => removePrompt(p.id))}
            className="cursor-pointer rounded p-1 text-ink-faint hover:bg-poor-soft hover:text-poor"
            aria-label="Delete prompt"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
