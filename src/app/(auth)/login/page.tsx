"use client";

import { useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { login } from "../actions";
import { Button, Card, Input, Label } from "@/components/ui";
import { useT } from "@/lib/i18n";

function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const callbackError = params.get("error");
  const t = useT();

  return (
    <Card className="w-full max-w-sm animate-rise p-6">
      <h1 className="text-lg font-semibold">{t("auth.loginTitle")}</h1>
      <p className="mt-1 text-sm text-ink-faint">{t("auth.loginSubtitle")}</p>
      {callbackError && (
        <p className="mt-3 rounded-lg bg-poor-soft px-3 py-2 text-xs text-poor">
          {t("auth.linkFailed", { error: callbackError })}
        </p>
      )}
      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" name="email" type="email" required placeholder="you@company.com" />
        </div>
        <div>
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" name="password" type="password" required placeholder="••••••••" />
        </div>
        {state?.error && <p className="text-sm text-poor">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("auth.loggingIn") : t("auth.logIn")}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-faint">
        {t("auth.noAccount")}{" "}
        <Link href="/signup" className="font-medium text-accent-strong hover:underline">
          {t("auth.startFree")}
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
