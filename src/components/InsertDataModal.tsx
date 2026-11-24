import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, AlertCircle } from "lucide-react";
import { RowDataEditor } from "@/components/explorer/RowDataEditor";
import type { ColumnInfo } from "@/domain/database/types";
import { toast } from "@/components/ui/toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  onInsert: (data: Record<string, unknown>) => Promise<void>;
  columns: ColumnInfo[];
}

export function InsertDataModal({ isOpen, onClose, tableName, onInsert, columns }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      setLoading(true);
      setError(null);
      await onInsert(data);
      onClose();
    } catch (err: any) {
      const message = err.message || t("modal_insert.failed");
      setError(message);
      toast({ title: t("toast.insert_failed"), description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !loading) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!loading}
        className="flex max-h-[86vh] max-w-[980px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[980px]"
      >
        <DialogHeader className="shrink-0 gap-1 border-b border-border px-5 py-3.5 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <Plus size={15} className="text-primary" />
            {t('modal_insert.title', { tableName })}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground">
            {t('modal_insert.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <RowDataEditor
            key={`${tableName}-${isOpen}`}
            mode="insert"
            columns={columns}
            disabled={loading}
            cancelLabel={t("common.cancel")}
            onCancel={onClose}
            submitLabel={loading ? t("data_preview.saving") : t("modal_insert.submit")}
            onSubmit={handleSubmit}
          />

          {error && (
            <div className="mx-6 mb-4 flex items-start gap-3 rounded-md bg-destructive/10 p-3 text-destructive animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-[12px] font-medium text-destructive">{t('explorer.engine_fault')}</p>
                <p className="text-[12px] leading-relaxed">{error}</p>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
