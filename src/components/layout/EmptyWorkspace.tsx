import { Database, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface EmptyWorkspaceProps {
  onCreateConnection: () => void;
}

export function EmptyWorkspace({ onCreateConnection }: EmptyWorkspaceProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center px-8">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-2xl border border-border bg-muted/60" />
          <div className="relative flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-md">
            <Database size={28} strokeWidth={1.75} />
          </div>
        </div>
        <h2 className="text-[18px] font-semibold tracking-tight text-foreground">
          {t("dashboard.title")}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          {t("dashboard.empty_desc")}
        </p>
        <Button
          className="mt-6 h-9 gap-1.5 rounded-md px-4 text-[13px] font-medium"
          onClick={onCreateConnection}
        >
          <Plus size={15} />
          {t("dashboard.new_connection")}
        </Button>
      </div>
    </div>
  );
}
