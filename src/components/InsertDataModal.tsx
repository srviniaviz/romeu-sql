import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, AlertCircle } from "lucide-react";

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: any;
  isPrimaryKey: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  onInsert: (data: Record<string, any>) => Promise<void>;
  columns: ColumnInfo[];
}

export function InsertDataModal({ isOpen, onClose, tableName, onInsert, columns }: Props) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form with default values if any
      const initialData: Record<string, any> = {};
      columns.forEach(col => {
        if (!col.isPrimaryKey) {
           initialData[col.name] = col.defaultValue || "";
        }
      });
      setFormData(initialData);
      setError(null);
    }
  }, [isOpen, columns]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await onInsert(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || t("modal_insert.failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[680px] overflow-hidden rounded-lg border-border/60 bg-background p-0 shadow-2xl">
        <DialogHeader className="border-b border-border/50 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
            <Plus size={17} className="text-primary" />
            {t('modal_insert.title', { tableName })}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground">
            {t('modal_insert.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex max-h-[78vh] flex-col">
          <div className="grid gap-x-4 gap-y-3 overflow-y-auto px-6 py-5 custom-scrollbar sm:grid-cols-2">
            {columns.filter(col => !col.isPrimaryKey).map((col) => (
              <div key={col.name} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={col.name} className="min-w-0 truncate text-[12px] font-medium normal-case tracking-normal text-muted-foreground">
                    {col.name}
                    </Label>
                    <span className="shrink-0 rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{col.type}</span>
                </div>
                <Input
                  id={col.name}
                  value={formData[col.name] || ""}
                  onChange={(e) => handleInputChange(col.name, e.target.value)}
                  placeholder={t("modal_insert.placeholder", { field: col.name.toLowerCase() })}
                  className="h-9 rounded-md border-border/70 bg-background text-[13px] focus-visible:ring-1 focus-visible:ring-primary/25"
                />
              </div>
            ))}
            
            {columns.filter(col => !col.isPrimaryKey).length === 0 && (
                <div className="col-span-full flex flex-col items-center gap-2 py-10 text-center text-muted-foreground/60">
                    <AlertCircle size={24} />
                    <span className="text-[13px] font-medium">{t('modal_insert.no_fields')}</span>
                </div>
            )}
          </div>

          {error && (
            <div className="mx-6 mb-4 flex items-start gap-3 rounded-md bg-destructive/10 p-3 text-destructive animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-[12px] font-medium text-destructive">{t('explorer.engine_fault')}</p>
                <p className="text-[12px] leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          <DialogFooter className="mt-auto flex items-center justify-end gap-2 border-t border-border/50 bg-muted/15 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-9 rounded-md px-4 text-[12px] font-medium text-muted-foreground"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-9 rounded-md bg-primary px-5 text-[12px] font-medium shadow-sm"
            >
              {loading ? <Loader2 size={14} className="animate-spin mr-2" /> : <Plus size={14} className="mr-2" />}
              {t('modal_insert.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
