"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { signup } from "../actions";
import { Button, Card, Input, Label } from "@/components/ui";
import { useT } from "@/lib/i18n";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, null);
  const params = useSearchParams();
  const next = params.get("next") ?? "/onboarding";
  const t = useT();

  if (state?.sent) {
    return (
      <Card className="w-full max-w-sm animate-rise p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft">
          <MailCheck className="h-5 w-5 text-accent-strong" />
        </span>
        <h1 className="mt-4 text-lg font-semibold">{t("auth.checkInbox")}</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {t("auth.confirmationSent", { email: state.email ?? "" })}
        </p>
        <p className="mt-4 text-xs text-ink-faint">
          {t("auth.noEmailHint")}{" "}
          <Link href="/signup" className="font-medium text-accent-strong hover:underline">
            {t("auth.tryAgain")}
          </Link>
          .
        </p>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm animate-rise p-6">
      <h1 className="text-lg font-semibold">{t("auth.startFree")}</h1>
      <p className="mt-1 text-sm text-ink-faint">{t("auth.signupSubtitle")}</p>
      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <Label htmlFor="name">{t("auth.name")}</Label>
          <Input id="name" name="name" required placeholder="Jane Kim" />
        </div>
        <div>
          <Label htmlFor="email">{t("auth.workEmail")}</Label>
          <Input id="email" name="email" type="email" required placeholder="you@company.com" />
        </div>
        <div>
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            placeholder={t("auth.passwordHint")}
          />
        </div>
        {state?.error && <p className="text-sm text-poor">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("auth.creatingAccount") : t("auth.createAccount")}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-faint">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-medium text-accent-strong hover:underline">
          {t("auth.logIn")}
        </Link>
      </p>
    </Card>
  );
}
