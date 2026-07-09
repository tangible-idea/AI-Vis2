"use client";

import { useRef, useState } from "react";
import { Card, CardHeader } from "@/components/ui";
import { ContentGenerator } from "./generator";
import { RecommendationList } from "./rec-list";
import type { Recommendation, RecommendationType } from "@/lib/types";

export function OptimizeClient({
  projectId,
  recommendations,
}: {
  projectId: string;
  recommendations: Recommendation[];
}) {
  const [selected, setSelected] = useState<{ type: RecommendationType; recId?: string } | null>(
    null
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
        />
      </div>
    </div>
  );
}
