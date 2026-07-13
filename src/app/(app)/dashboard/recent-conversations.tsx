import { engineInfo } from "@/lib/ai/engines";
import { timeAgo } from "@/lib/utils";
import { Badge, Card, CardHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import type { ScanResult } from "@/lib/types";

export interface ConversationItem extends Pick<
  ScanResult,
  | "id"
  | "engine"
  | "response_text"
  | "brand_mentioned"
  | "brand_position"
  | "recommended"
  | "competitors_mentioned"
  | "sources"
  | "created_at"
> {
  promptText: string;
}

/**
 * Recent AI Conversations — the primary activity feed: what each platform
 * actually answered, at a glance, expandable to the full response with
 * sources and citations. Server-rendered; <details> keeps it interactive
 * without client JS.
 */
export async function RecentConversations({
  items,
  projectName,
}: {
  items: ConversationItem[];
  projectName: string;
}) {
  const t = await getT();
  if (!items.length) return null;

  return (
    <Card>
      <CardHeader
        title={t("conversations.title")}
        hint={t("conversations.hint")}
      />
      <div className="divide-y divide-line px-5 pb-4">
        {items.map((r) => {
          const info = engineInfo(r.engine);
          return (
            <details key={r.id} className="group py-2.5">
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <span
                  className="w-16 shrink-0 truncate text-xs font-semibold"
                  style={{ color: info.color }}
                  title={info.label}
                >
                  {info.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">“{r.promptText}”</span>
                <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                  {r.recommended ? (
                    <Badge tone="good">{t("conversations.recommended")}</Badge>
                  ) : r.brand_mentioned ? (
                    <Badge tone="accent">
                      {t("conversations.mentioned")}
                      {r.brand_position ? ` #${r.brand_position}` : ""}
                    </Badge>
                  ) : (
                    <Badge tone="poor">{t("conversations.notMentioned")}</Badge>
                  )}
                  {r.competitors_mentioned.length > 0 && (
                    <Badge tone="mid">
                      {t("conversations.competitors", { count: r.competitors_mentioned.length })}
                    </Badge>
                  )}
                </span>
                <span className="shrink-0 text-[11px] text-ink-faint">{timeAgo(r.created_at)}</span>
                <span className="text-xs text-ink-faint transition-transform group-open:rotate-90">›</span>
              </summary>
              <div className="mb-1 mt-2 space-y-2 rounded-lg border border-line bg-paper p-3">
                <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-ink-soft">
                  {r.response_text}
                </p>
                {r.competitors_mentioned.length > 0 && (
                  <p className="text-[11px] text-ink-faint">
                    <span className="font-medium text-ink-soft">{t("conversations.competitorsLabel")}</span>{" "}
                    {r.competitors_mentioned.join(", ")}
                  </p>
                )}
                {(r.sources ?? []).length > 0 && (
                  <p className="text-[11px] text-ink-faint">
                    <span className="font-medium text-ink-soft">{t("conversations.sourcesLabel")}</span>{" "}
                    {(r.sources ?? []).map((s, i) => (
                      <span key={s.url}>
                        {i > 0 && ", "}
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-accent-strong hover:underline"
                        >
                          {s.domain}
                        </a>
                      </span>
                    ))}
                  </p>
                )}
                <p className="text-[11px] text-ink-faint">
                  <span className="font-medium text-ink-soft">{t("conversations.projectLabel")}</span>{" "}
                  {projectName}
                </p>
              </div>
            </details>
          );
        })}
      </div>
    </Card>
  );
}
