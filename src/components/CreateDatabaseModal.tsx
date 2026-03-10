import { useState } from "react";
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
          <DialogTitle className="text-2xl font-black italic uppercase italic tracking-tighter">Create New Database</DialogTitle>
          <DialogDescription className="text-xs font-medium opacity-60">
            Define a name for your new engine schema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest opacity-40">Database Name</Label>
            <Input 
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              placeholder="my_new_database"
              className="h-11 font-bold tracking-tight bg-muted/20 border-border/5"
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-2 text-destructive animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Engine Error</p>
                <p className="text-[11px] font-bold leading-relaxed whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading} className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100">
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || !dbName.trim()} className="text-[10px] font-black uppercase tracking-widest px-8">
            {loading ? <Loader2 className="animate-spin" size={14} /> : 'Create Database'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
