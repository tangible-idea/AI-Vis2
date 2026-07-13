"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Ticket } from "lucide-react";
import { Button, ButtonLink, Card, Input, Label } from "@/components/ui";
import { useT } from "@/lib/i18n";

interface RedeemSuccess {
  projects: number;
  prompts: number;
  scansPerMonth: number;
}

export function RedeemForm({ signedIn, email }: { signedIn: boolean; email: string | null }) {
  const t = useT();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RedeemSuccess | null>(null);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? t("redeem.error"));
      else setSuccess(data.summary as RedeemSuccess);
    } catch {
      setError(t("redeem.error"));
    }
    setBusy(false);
  }

  if (success) {
    return (
      <Card className="w-full max-w-sm animate-rise p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-good-soft">
          <BadgeCheck className="h-5 w-5 text-good" />
        </span>
        <h1 className="mt-4 text-lg font-semibold">{t("redeem.successTitle")}</h1>
        <p className="mt-2 text-sm text-ink-soft">{t("redeem.successBody")}</p>
        <ul className="mx-auto mt-4 max-w-xs space-y-1.5 text-left text-sm text-ink-soft">
          <li>· {t("redeem.successProjects", { count: success.projects })}</li>
          <li>· {t("redeem.successPrompts", { count: success.prompts })}</li>
          <li>· {t("redeem.successScans", { count: success.scansPerMonth })}</li>
        </ul>
        <ButtonLink href="/dashboard" className="mt-6 w-full">
          {t("redeem.goToDashboard")}
        </ButtonLink>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm animate-rise p-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft">
        <Ticket className="h-5 w-5 text-accent-strong" />
      </span>
      <h1 className="mt-4 text-lg font-semibold">{t("redeem.title")}</h1>
      <p className="mt-1 text-sm text-ink-faint">{t("redeem.subtitle")}</p>

      {signedIn ? (
        <form onSubmit={redeem} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="code">{t("redeem.codeLabel")}</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
              required
            />
          </div>
          {email && (
            <p className="text-xs text-ink-faint">{t("redeem.activatingFor", { email })}</p>
          )}
          {error && <p className="text-sm text-poor">{error}</p>}
          <Button type="submit" disabled={busy || !code.trim()} className="w-full">
            {busy ? t("redeem.activating") : t("redeem.activate")}
          </Button>
        </form>
      ) : (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-ink-soft">{t("redeem.needAccount")}</p>
          <ButtonLink href="/signup?next=/redeem" className="w-full">
            {t("redeem.createAccount")}
          </ButtonLink>
          <p className="text-center text-sm text-ink-faint">
            {t("auth.haveAccount")}{" "}
            <Link href="/login?next=/redeem" className="font-medium text-accent-strong hover:underline">
              {t("auth.logIn")}
            </Link>
          </p>
        </div>
      )}
    </Card>
  );
}
