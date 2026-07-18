"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui";

const CONSENT_KEY = "sightline_cookie_consent"; // "all" | "essential"

/** Records the choice in localStorage + a long-lived cookie so it persists
 *  and could gate future non-essential scripts server-side. */
function persist(choice: "all" | "essential") {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    /* storage blocked — the cookie below still records the choice */
  }
  document.cookie = `${CONSENT_KEY}=${choice}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * Lightweight, non-blocking cookie consent — shown once on first visit at the
 * bottom of the page. "Got it" accepts all; "Decline optional" keeps only
 * strictly-necessary cookies. No full preference center (Sightline only uses
 * essential cookies today); the choice is remembered so this never reappears.
 */
export function CookieConsent() {
  // start hidden; reveal only after confirming no prior choice, to avoid a flash
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  function choose(choice: "all" | "essential") {
    persist(choice);
    setShow(false);
  }

  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:p-4">
      <div
        role="dialog"
        aria-label="Cookie consent"
        className="animate-rise pointer-events-auto w-full max-w-md rounded-xl border border-line bg-surface p-4 shadow-pop"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hover">
            <Cookie className="h-4 w-4 text-ink-soft" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">We use cookies</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              Sightline uses essential cookies to keep you signed in and remember your preferences.
              With your consent we may also use optional cookies to improve the product. See our{" "}
              <Link href="/legal/cookies" className="text-accent-strong underline">
                Cookie Policy
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" className="text-accent-strong underline">
                Privacy Policy
              </Link>
              .
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => choose("all")}>
                Got it
              </Button>
              <Button variant="secondary" size="sm" onClick={() => choose("essential")}>
                Decline optional
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
