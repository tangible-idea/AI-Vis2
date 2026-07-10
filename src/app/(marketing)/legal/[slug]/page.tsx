import { notFound } from "next/navigation";
import Link from "next/link";
import { LEGAL_DOCS } from "../content";
import { LEGAL_PAGES } from "@/components/legal-links";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = LEGAL_DOCS.find((d) => d.slug === slug);
  return { title: doc?.title ?? "Legal" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = LEGAL_DOCS.find((d) => d.slug === slug);
  if (!doc) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <nav className="mb-8 flex flex-wrap gap-2 text-xs">
        {LEGAL_PAGES.map((p) => (
          <Link
            key={p.slug}
            href={`/legal/${p.slug}`}
            className={cn(
              "rounded-full px-3 py-1 font-medium",
              p.slug === doc.slug ? "bg-ink text-paper" : "bg-hover text-ink-soft hover:text-ink"
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight">{doc.title}</h1>
      <p className="mt-1 text-sm text-ink-faint">Last updated {doc.updated}</p>

      <div className="mt-8 space-y-7">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-sm font-semibold text-ink">{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-2 text-sm leading-relaxed text-ink-soft">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
