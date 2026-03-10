import { useState, useEffect } from "react";
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
      <DialogContent className="max-w-md bg-card/95 backdrop-blur-2xl border-border/10 rounded-3xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
            <Plus size={20} className="text-primary" />
            Insert Into {tableName}
          </DialogTitle>
          <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-40">
            Add a new record to this collection
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar px-1">
            {columns.filter(col => !col.isPrimaryKey).map((col) => (
              <div key={col.name} className="space-y-2">
                <div className="flex justify-between items-center px-1">
                    <Label htmlFor={col.name} className="text-[10px] font-black uppercase tracking-widest opacity-60">
                    {col.name}
                    </Label>
                    <span className="text-[9px] font-mono opacity-20 uppercase">{col.type}</span>
                </div>
                <Input
                  id={col.name}
                  value={formData[col.name] || ""}
                  onChange={(e) => handleInputChange(col.name, e.target.value)}
                  placeholder={`Enter ${col.name.toLowerCase()}...`}
                  className="bg-muted/20 border-border/5 rounded-xl h-10 text-xs font-medium focus:ring-primary/20"
                />
              </div>
            ))}
            
            {columns.filter(col => !col.isPrimaryKey).length === 0 && (
                <div className="py-10 text-center opacity-20 flex flex-col items-center gap-2">
                    <AlertCircle size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest">No editable fields found</span>
                </div>
            )}
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60 text-destructive">Insertion Failed</p>
                <p className="text-xs font-bold leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-end gap-3 mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="rounded-xl h-10 px-4 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl h-10 px-6 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 bg-primary"
            >
              {loading ? <Loader2 size={14} className="animate-spin mr-2" /> : <Plus size={14} className="mr-2" />}
              Save Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
