import { useState } from "react";
import { useTranslation } from "react-i18next";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Database as DatabaseIcon, Loader2, AlertCircle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (dbName: string) => Promise<void>;
}

export function CreateDatabaseModal({ isOpen, onClose, onCreate }: Props) {
  const { t } = useTranslation();
  const [dbName, setDbName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!dbName.trim()) return;
    try {
      setLoading(true);
      setError(null);
      await onCreate(dbName);
      setDbName("");
      onClose();
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <DatabaseIcon size={24} />
          </div>
          <DialogTitle className="text-lg font-semibold tracking-tight">{t('modal_create_db.title')}</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            {t('modal_create_db.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('modal_create_db.field_label')}</Label>
            <Input 
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              placeholder={t('modal_create_db.placeholder')}
              className="h-10 bg-background"
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-2 text-destructive animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-[12px] font-medium">Engine error</p>
                <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading} className="text-[13px] font-medium text-muted-foreground">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={loading || !dbName.trim()} className="px-8 text-[13px] font-medium">
            {loading ? <Loader2 className="animate-spin" size={14} /> : t('modal_create_db.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
