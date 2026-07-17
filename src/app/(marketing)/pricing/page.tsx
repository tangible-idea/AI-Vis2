import { PlanComparison } from "@/components/plan-comparison";

export const metadata = {
  title: "Pricing",
  description:
    "Sightline pricing: start free, upgrade for weekly AI visibility scans, trends, content generation and white label reports. Monitor your brand across ChatGPT, Claude, Gemini and Perplexity.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-center text-3xl tracking-tight">
        Pricing that scales <span className="font-display italic">with your visibility</span>
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-sm text-ink-soft">
        Start free, upgrade when the score starts moving. Most teams pick Starter — weekly scans,
        trends and content generation for one focused price. No credit card required.
      </p>

      <div className="mt-12">
        <PlanComparison />
      </div>

      <p className="mx-auto mt-8 max-w-lg text-center text-xs leading-relaxed text-ink-faint">
        Pro includes everything in Starter, plus more capacity and white label reports.
        Cancel anytime — your plan stays active until the end of the billing period.
        <br />Annual billing (2 months free) coming soon.
      </p>
    </main>
  );
}
