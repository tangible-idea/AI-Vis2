"use client";

import { useRef, useState } from "react";
import { Card, CardHeader } from "@/components/ui";
import { ContentGenerator } from "./generator";
import { RecommendationList } from "./rec-list";
import { CONTENT_TYPES, type ContentType } from "@/lib/content/templates";
import type { Recommendation } from "@/lib/types";

export function OptimizeClient({
  projectId,
  recommendations,
  prefillType,
  prefillTopic,
}: {
  projectId: string;
  recommendations: Recommendation[];
  /** Deep-link prefill, e.g. from Trends: /optimize?type=blog_post&topic=… */
  prefillType?: string;
  prefillTopic?: string;
}) {
  const validPrefill = CONTENT_TYPES.some((t) => t.id === prefillType)
    ? (prefillType as ContentType)
    : undefined;
  const [selected, setSelected] = useState<{ type: ContentType; recId?: string } | null>(
    validPrefill ? { type: validPrefill } : null
  );
  const generatorRef = useRef<HTMLDivElement>(null);

  return (
    <div className="stagger space-y-4">
      <Card>
        <CardHeader
          title="Recommended actions"
          hint="Prioritized from your latest scan — click the circle to track progress"
        />
        <div className="px-5 pb-2">
          <RecommendationList
            recommendations={recommendations}
            onGenerate={(rec) => {
              setSelected({ type: rec.type, recId: rec.id });
              generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        </div>
      </Card>

      <div ref={generatorRef} className="scroll-mt-20">
        <h2 className="mb-2 px-1 text-sm font-semibold">Content generator</h2>
        <ContentGenerator
          projectId={projectId}
          initialType={selected?.type}
          recommendationId={selected?.recId}
          initialInstructions={
            prefillTopic ? `Focus on the trending topic: "${prefillTopic}"` : undefined
          }
        />
      </div>
    </div>
  );
}
