"use client";

import { useTransition } from "react";
import { deleteProject } from "./actions";
import { Button } from "@/components/ui";

export function DeleteProjectButton({ projectId, name }: { projectId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Delete "${name}" and all its scans, content and history? This cannot be undone.`)) {
          start(() => deleteProject(projectId));
        }
      }}
    >
      {pending ? "Deleting…" : "Delete project"}
    </Button>
  );
}
