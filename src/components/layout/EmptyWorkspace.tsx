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
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-7 flex size-28 items-center justify-center rounded-full bg-muted text-muted-foreground/30">
          <Database size={58} strokeWidth={1.5} />
        </div>
        <h2 className="text-[22px] font-semibold tracking-tight text-foreground">
          {t("dashboard.title")}
        </h2>
        <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
          Select a connection from the sidebar or create a new workspace to inspect databases,
          tables, and rows.
        </p>
        <Button
          className="mt-6 h-9 rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
          onClick={onCreateConnection}
        >
          <Plus size={15} className="mr-2" />
          New connection
        </Button>
      </div>
    </div>
  );
}
