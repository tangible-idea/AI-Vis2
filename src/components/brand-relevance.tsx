"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, SlidersHorizontal, X } from "lucide-react";
import {
  confirmBrandRelevance,
  improveBrandProfile,
  type ImproveBrandState,
} from "@/app/(app)/actions";
import { Button, Input, Label } from "@/components/ui";
import { IndustrySelect } from "@/components/industry-select";
import { useT } from "@/lib/i18n";

export interface BrandRelevanceFields {
  projectId: string;
  company: string;
  website: string;
  industry: string;
  description: string;
  /** Existing competitor inputs, one per editable slot. */
  competitors: string[];
}

/**
 * Lightweight relevance check shown once the first two scans have completed:
 * "Are these results relevant to your brand?" — Yes, or refine the Brand
 * Profile fields that actually influence matching. Everything else stays put,
 * so nothing already answered has to be answered again.
 */
export function BrandRelevance({ fields }: { fields: BrandRelevanceFields }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [confirming, startConfirm] = useTransition();
  const [state, action, saving] = useActionState<ImproveBrandState | null, FormData>(
    improveBrandProfile,
    null
  );

  if (dismissed || state?.saved) return null;

  if (!open) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-line-strong bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink">{t("relevance.question")}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={confirming}
            onClick={() =>
              startConfirm(async () => {
                await confirmBrandRelevance(fields.projectId);
                setDismissed(true);
              })
            }
          >
            <Check className="h-3.5 w-3.5" />
            {t("relevance.yes")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t("relevance.improve")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{t("relevance.improveTitle")}</p>
          <p className="mt-0.5 text-xs text-ink-faint">{t("relevance.improveHint")}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t("common.close")}
          className="cursor-pointer rounded-lg p-1 text-ink-faint hover:bg-hover hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="projectId" value={fields.projectId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="r-name">{t("settings.companyBrand")}</Label>
            <Input id="r-name" name="name" defaultValue={fields.company} required />
          </div>
          <div>
            <Label htmlFor="r-website">{t("settings.website")}</Label>
            <Input id="r-website" name="website" defaultValue={fields.website} required />
          </div>
        </div>
        <div>
          <Label htmlFor="r-industry">{t("settings.industry")}</Label>
          <IndustrySelect id="r-industry" name="industry" defaultValue={fields.industry} required />
        </div>
        <div>
          <Label htmlFor="r-description">
            {t("settings.businessDescription")}{" "}
            <span className="font-normal text-ink-faint">{t("onboarding.optional")}</span>
          </Label>
          <textarea
            id="r-description"
            name="description"
            rows={3}
            maxLength={500}
            defaultValue={fields.description}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
          />
          <p className="mt-1 text-[11px] text-ink-faint">{t("relevance.descriptionHint")}</p>
        </div>
        {fields.competitors.length > 0 && (
          <div>
            <Label>{t("onboarding.competitors")}</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {fields.competitors.map((c, i) => (
                <Input
                  key={i}
                  name={`competitor${i}`}
                  defaultValue={c}
                  placeholder={`competitor${i + 1}.com`}
                />
              ))}
            </div>
          </div>
        )}

        {state?.error && <p className="text-sm text-poor">{state.error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? t("common.saving") : t("relevance.save")}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
