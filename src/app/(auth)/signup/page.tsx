"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "../actions";
import { Button, Card, Input, Label } from "@/components/ui";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, null);

  return (
    <Card className="w-full max-w-sm animate-rise p-6">
      <h1 className="text-lg font-semibold">Start free</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Your first AI visibility scan takes under 10 minutes.
      </p>
      <form action={action} className="mt-5 space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required placeholder="Jane Kim" />
        </div>
        <div>
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" required placeholder="you@company.com" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="8+ characters"
          />
        </div>
        {state?.error && <p className="text-sm text-poor">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-faint">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent-strong hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}
