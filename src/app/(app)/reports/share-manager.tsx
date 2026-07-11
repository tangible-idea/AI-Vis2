"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Trash2 } from "lucide-react";
import { Button, Select } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { ShareLink } from "@/lib/types";

export function ShareManager({
  projectId,
  links,
  locked,
}: {
  projectId: string;
  links: ShareLink[];
  locked: boolean;
}) {
  const [expiry, setExpiry] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const router = useRouter();
  const t = useT();

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        expiresInDays: expiry === "never" ? null : Number(expiry),
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else router.refresh();
    setBusy(false);
  }

  async function revoke(id: string) {
    await fetch("/api/share", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  async function copy(link: ShareLink) {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${link.token}`);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className="w-40"
          aria-label="Link expiry"
        >
          <option value="7">{t("share.expires7")}</option>
          <option value="30">{t("share.expires30")}</option>
          <option value="90">{t("share.expires90")}</option>
          <option value="never">{t("share.neverExpires")}</option>
        </Select>
        <Button onClick={create} disabled={busy || locked} size="sm">
          <Link2 className="h-3.5 w-3.5" /> {t("share.createLink")}
        </Button>
      </div>
      {locked && <p className="mt-2 text-xs text-mid">{t("share.locked")}</p>}
      {error && <p className="mt-2 text-xs text-poor">{error}</p>}

      {links.length > 0 && (
        <div className="mt-4 divide-y divide-line">
          {links.map((link) => (
            <div key={link.id} className="flex items-center gap-3 py-2.5 text-sm">
              <code className="tabular flex-1 truncate text-xs text-ink-soft">
                /share/{link.token}
              </code>
              <span className="hidden text-xs text-ink-faint sm:block">
                {link.expires_at ? t("share.expiresOn", { date: formatDate(link.expires_at) }) : t("share.noExpiry")}
              </span>
              <button
                onClick={() => copy(link)}
                className="cursor-pointer rounded p-1 text-ink-faint hover:bg-hover hover:text-ink"
                title="Copy URL"
              >
                {copiedId === link.id ? (
                  <Check className="h-3.5 w-3.5 text-good" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => revoke(link.id)}
                className="cursor-pointer rounded p-1 text-ink-faint hover:bg-poor-soft hover:text-poor"
                title="Revoke"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
