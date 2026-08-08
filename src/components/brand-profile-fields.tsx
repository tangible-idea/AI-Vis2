"use client";

import { Input, Label } from "@/components/ui";
import { IndustrySelect } from "@/components/industry-select";
import { BRAND_PROFILE_COMPETITOR_SLOTS } from "@/lib/brand";
import { useT } from "@/lib/i18n";

/**
 * The Brand Profile — the business information every scan, prompt and score is
 * derived from.
 *
 * Defined once and rendered by all three places it can be edited: onboarding,
 * Settings → Project and "Refine your brand profile". Field names, order,
 * placeholders, industry options and helper text therefore cannot drift apart,
 * and the same profile reads the same wherever a user meets it.
 *
 * The inputs are uncontrolled and named exactly as the server actions expect
 * (`name`, `website`, `industry`, `description`, `competitor0…n`), so a form
 * only has to render this and submit.
 */

/** Example values, shared so every form demonstrates the same conventions. */
const PLACEHOLDER = {
  name: "Acme Bookings",
  /** A bare domain is valid input; app listings are accepted too. */
  website: "acme.com",
  description: "e.g. Online reservation software for independent restaurants in Korea and Japan",
  competitor: (i: number) => `competitor${i + 1}.com`,
} as const;

export interface BrandProfileValues {
  name?: string;
  website?: string;
  industry?: string;
  description?: string;
}

/** Label plus the marker that says the field is required. */
function FieldLabel({
  htmlFor,
  text,
  required,
  optional,
}: {
  htmlFor: string;
  text: string;
  required?: boolean;
  optional?: boolean;
}) {
  const t = useT();
  return (
    <Label htmlFor={htmlFor}>
      {text}
      {required && <span className="ml-0.5 text-ink-faint">{t("settings.requiredMark")}</span>}
      {optional && <span className="ml-1 font-normal text-ink-faint">{t("onboarding.optional")}</span>}
    </Label>
  );
}

export function BrandProfileFields({
  idPrefix,
  values,
}: {
  /** Keeps ids unique when more than one form exists on a page. */
  idPrefix: string;
  values?: BrandProfileValues;
}) {
  const t = useT();
  const id = (field: string) => `${idPrefix}-${field}`;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={id("name")} text={t("settings.companyBrand")} required />
          <Input
            id={id("name")}
            name="name"
            required
            placeholder={PLACEHOLDER.name}
            defaultValue={values?.name ?? ""}
          />
        </div>
        <div>
          <FieldLabel htmlFor={id("website")} text={t("settings.website")} required />
          {/* not type="url": a bare domain is valid input and is normalized
              server-side, the same way in every form */}
          <Input
            id={id("website")}
            name="website"
            required
            placeholder={PLACEHOLDER.website}
            defaultValue={values?.website ?? ""}
          />
          <p className="mt-1 text-[11px] text-ink-faint">{t("settings.websiteHint")}</p>
        </div>
      </div>
      <div>
        <FieldLabel htmlFor={id("industry")} text={t("settings.industry")} required />
        <IndustrySelect id={id("industry")} name="industry" required defaultValue={values?.industry} />
      </div>
      <div>
        <FieldLabel htmlFor={id("description")} text={t("settings.businessDescription")} optional />
        <textarea
          id={id("description")}
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={values?.description ?? ""}
          placeholder={PLACEHOLDER.description}
          className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
        />
        <p className="mt-1 text-[11px] text-ink-faint">{t("settings.businessDescriptionHint")}</p>
      </div>
    </>
  );
}

/**
 * The competitor slots that belong to the Brand Profile. Positional: slot i is
 * competitor i, which is what lets an edit update a competitor in place rather
 * than replacing the list.
 */
export function CompetitorFields({
  slots = BRAND_PROFILE_COMPETITOR_SLOTS,
  values = [],
}: {
  slots?: number;
  values?: string[];
}) {
  const t = useT();
  return (
    <div>
      <Label>{t("settings.competitorsLabel", { max: slots })}</Label>
      <div className="grid gap-2 sm:grid-cols-3">
        {Array.from({ length: slots }, (_, i) => (
          <Input
            key={i}
            name={`competitor${i}`}
            defaultValue={values[i] ?? ""}
            placeholder={PLACEHOLDER.competitor(i)}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-ink-faint">{t("settings.competitorInputHint")}</p>
    </div>
  );
}
