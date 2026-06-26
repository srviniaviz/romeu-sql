import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Plus, 
  Trash2, 
  Table as TableIcon,
  FileCode,
  AlertCircle,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useSchemaDesigner, DbEngine } from "../lib/useSchemaDesigner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  dbType: string;
  onCreate: (sql: string) => Promise<void>;
}

export function CreateTableModal({ isOpen, onClose, dbType, onCreate }: Props) {
  const { t } = useTranslation();
  const {
    tableName,
    setTableName,
    columns,
    addColumn,
    removeColumn,
    updateColumn,
    commonTypes,
    generatedSql,
    reset
  } = useSchemaDesigner(dbType as DbEngine);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!tableName) return;
    try {
        setLoading(true);
        setError(null);
        await onCreate(generatedSql);
        onClose();
        reset();
    } catch (err: any) {
        const msg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
        setError(msg);
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <TableIcon size={20} />
            </div>
            <div>
              <DialogTitle>{t('modal_create_table.title')}</DialogTitle>
              <DialogDescription>
                {t('modal_create_table.description', { dbType: dbType.toUpperCase() })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Designer */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="p-6 pb-2 shrink-0">
              <div className="grid gap-2">
                <Label htmlFor="tableName">{t('modal_create_table.field_label')}</Label>
                <Input 
                  id="tableName"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder={t('modal_create_table.placeholder')} 
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar">
              <div className="space-y-4 pb-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[12px] font-medium text-muted-foreground">{t('modal_create_table.columns_label')}</h4>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={addColumn}
                    className="h-8 gap-2 text-xs"
                  >
                    <Plus size={14} /> {t('modal_create_table.add_column')}
                  </Button>
                </div>

                <div className="space-y-4">
                  <AnimatePresence initial={false}>
                    {columns.map((col) => (
                      <motion.div 
                        key={col.id}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="flex flex-col gap-3 p-4 rounded-xl border border-muted bg-muted/20 hover:bg-muted/30 hover:border-primary/20 transition-all relative group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="grid grid-cols-[1fr,160px] gap-2 flex-1">
                            <Input 
                              value={col.name}
                              onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                              placeholder={t('modal_create_table.column_name_placeholder')}
                              className="h-9 bg-background/50 border-muted"
                            />

                            <Select value={col.type} onValueChange={(val) => updateColumn(col.id, { type: val })}>
                              <SelectTrigger className="h-9 text-xs bg-background/50 border-muted">
                                <SelectValue placeholder={t('modal_create_table.column_type_placeholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                {commonTypes.map(t => (
                                  <SelectItem key={t} value={t} className="text-xs font-mono">{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => removeColumn(col.id)}
                            disabled={columns.length === 1}
                            className="size-8 shrink-0 opacity-20 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-4 px-3 h-9 border border-muted rounded-md bg-background/40">
                            <div className="flex items-center gap-2" title="Primary Key">
                              <Checkbox 
                                id={`pk-${col.id}`}
                                checked={col.isPrimary} 
                                onCheckedChange={(val) => updateColumn(col.id, { isPrimary: !!val, isNullable: !val })} 
                                className="size-4 border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                              <Label htmlFor={`pk-${col.id}`} className="cursor-pointer transition-colors group-hover:text-foreground">{t('modal_create_table.column_primary')}</Label>
                            </div>
                            
                            <Separator orientation="vertical" className="h-4 bg-muted" />

                            <div className="flex items-center gap-2" title="Nullable">
                              <Checkbox 
                                id={`null-${col.id}`}
                                checked={col.isNullable} 
                                onCheckedChange={(val) => updateColumn(col.id, { isNullable: !!val })} 
                                disabled={col.isPrimary}
                                className="size-4 border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                              <Label htmlFor={`null-${col.id}`} className="cursor-pointer transition-colors group-hover:text-foreground">{t('modal_create_table.column_nullable')}</Label>
                            </div>
                          </div>

                          <Input 
                            value={col.defaultValue}
                            onChange={(e) => updateColumn(col.id, { defaultValue: e.target.value })}
                            placeholder={t('modal_create_table.column_default_placeholder')}
                            className="h-9 text-xs font-mono flex-1 bg-background/40 border-muted"
                          />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {error && (
                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3 text-destructive animate-in fade-in slide-in-from-top-1">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <div className="space-y-1">
                            <p className="text-[12px] font-medium">Engine error</p>
                            <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{error}</p>
                        </div>
                    </div>
                )}
              </div>
            </div>
          </div>

          {/* SQL Preview Sidebar */}
          <div className="w-[300px] bg-muted/10 flex flex-col p-6 border-l shrink-0">
            <div className="flex items-center gap-2 mb-4 opacity-70">
              <FileCode size={16} />
              <span className="text-[12px] font-medium text-muted-foreground">{t('modal_create_table.sql_preview')}</span>
            </div>

            <div className="flex-1 rounded-lg border bg-muted/20 p-4 font-mono text-[10px] text-muted-foreground overflow-y-auto custom-scrollbar">
              <pre className="whitespace-pre-wrap">{generatedSql}</pre>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 flex gap-2 shrink-0">
              <AlertCircle size={14} className="text-amber-500 shrink-0" />
              <p className="text-[10px] text-amber-500/80 leading-snug">
                {t('modal_create_table.warn_modification')}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button 
            onClick={handleCreate}
            disabled={!tableName || columns.some(c => !c.name) || loading}
            className="min-w-[120px]"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : t('modal_create_table.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
