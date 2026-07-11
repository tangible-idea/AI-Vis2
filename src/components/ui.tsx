import { cn } from "@/lib/utils";
import Link from "next/link";

/* Minimal primitive set — one visual system, no variants sprawl. */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface shadow-card",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-1">
      <div>
        <h3 className="text-[13px] font-semibold tracking-wide text-ink">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

type ButtonProps = {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
const buttonVariants = {
  primary: "bg-ink text-paper hover:bg-ink/85",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-hover",
  ghost: "text-ink-soft hover:bg-hover hover:text-ink",
  danger: "border border-poor/30 text-poor hover:bg-poor-soft",
};
const buttonSizes = { sm: "h-8 px-3 text-xs", md: "h-9.5 px-4 text-sm" };

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  children,
}: {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(buttonBase, buttonVariants[variant!], buttonSizes[size!], className)}
    >
      {children}
    </Link>
  );
}

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "good" | "mid" | "poor" | "neutral" | "accent";
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    good: "bg-good-soft text-good",
    mid: "bg-mid-soft text-mid",
    poor: "bg-poor-soft text-poor",
    accent: "bg-accent-soft text-accent-strong",
    neutral: "bg-hover text-ink-soft",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9.5 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9.5 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1.5 block text-xs font-medium text-ink-soft", className)} {...props}>
      {children}
    </label>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="dot-grid flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-faint">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Blur-locked premium card for free-plan gating. */
export function LockedOverlay({
  message,
  cta = "Upgrade",
  children,
}: {
  message: string;
  cta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="pointer-events-none select-none blur-[6px]" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-paper/40">
        <p className="text-sm font-medium text-ink">{message}</p>
        <ButtonLink href="/billing" size="sm">
          {cta}
        </ButtonLink>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-faint">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
