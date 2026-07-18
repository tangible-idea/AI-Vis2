"use client";

import { useState } from "react";
import { Select } from "@/components/ui";
import { INDUSTRIES, normalizeIndustry } from "@/lib/types";

/**
 * Industry dropdown with helper text that updates as the category changes.
 * One component for onboarding, settings and the public preview so the
 * taxonomy and copy stay identical everywhere.
 */
export function IndustrySelect({
  id = "industry",
  name = "industry",
  defaultValue,
  required,
}: {
  id?: string;
  name?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  // legacy stored values map forward so the field shows a valid category
  const [value, setValue] = useState(() => normalizeIndustry(defaultValue || INDUSTRIES[0].id));
  const helper = INDUSTRIES.find((i) => i.id === value)?.helper;

  return (
    <div>
      <Select id={id} name={name} required={required} value={value} onChange={(e) => setValue(e.target.value)}>
        {INDUSTRIES.map((i) => (
          <option key={i.id} value={i.id}>
            {i.label}
          </option>
        ))}
      </Select>
      {helper && <p className="mt-1 text-[11px] leading-snug text-ink-faint">{helper}</p>}
    </div>
  );
}
