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
      setError(err.message || "Failed to insert record");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Plus size={20} className="text-primary" />
            {t('modal_insert.title', { tableName })}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            {t('modal_insert.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar px-1">
            {columns.filter(col => !col.isPrimaryKey).map((col) => (
              <div key={col.name} className="space-y-2">
                <div className="flex justify-between items-center px-1">
                    <Label htmlFor={col.name}>
                    {col.name}
                    </Label>
                    <span className="text-[11px] font-mono text-muted-foreground">{col.type}</span>
                </div>
                <Input
                  id={col.name}
                  value={formData[col.name] || ""}
                  onChange={(e) => handleInputChange(col.name, e.target.value)}
                  placeholder={`Enter ${col.name.toLowerCase()}...`}
                  className="h-10 rounded-md bg-background text-[13px] focus:ring-primary/20"
                />
              </div>
            ))}
            
            {columns.filter(col => !col.isPrimaryKey).length === 0 && (
                <div className="py-10 text-center opacity-20 flex flex-col items-center gap-2">
                    <AlertCircle size={24} />
                    <span className="text-[13px] font-medium">{t('modal_insert.no_fields')}</span>
                </div>
            )}
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-[12px] font-medium text-destructive">{t('explorer.engine_fault')}</p>
                <p className="text-[12px] leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-end gap-3 mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-10 rounded-md px-4 text-[13px] font-medium text-muted-foreground"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-10 rounded-md bg-primary px-6 text-[13px] font-medium shadow-sm"
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
