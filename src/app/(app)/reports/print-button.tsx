"use client";

export function PrintButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:bg-hover"
    >
      {children}
    </button>
  );
}
