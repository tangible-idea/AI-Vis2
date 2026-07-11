"use client";

import { useTransition } from "react";
import { deleteProject } from "./actions";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";

export function DeleteProjectButton({ projectId, name }: { projectId: string; name: string }) {
  const [pending, start] = useTransition();
  const t = useT();
  return (
    <Button
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (window.confirm(t("settings.deleteConfirm", { name }))) {
          start(() => deleteProject(projectId));
        }
      }}
    >
      {pending ? t("settings.deleting") : t("settings.deleteProject")}
    </Button>
  );
}
