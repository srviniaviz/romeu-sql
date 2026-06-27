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
      setError(err.message || t("modal_insert.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[980px] overflow-hidden rounded-lg border-border/60 bg-background p-0 shadow-2xl">
        <DialogHeader className="border-b border-border/50 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
            <Plus size={17} className="text-primary" />
            {t('modal_insert.title', { tableName })}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground">
            {t('modal_insert.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[78vh] flex-col">
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
