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
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden rounded-lg border-border/60 bg-background p-0 shadow-2xl sm:max-w-[920px]">
        <DialogHeader className="border-b border-border/50 px-6 py-5">
          <div className="flex items-center gap-3">
            <TableIcon size={17} className="text-primary" />
            <div>
              <DialogTitle className="text-[16px] font-semibold tracking-tight">{t('modal_create_table.title')}</DialogTitle>
              <DialogDescription className="text-[12px]">
                {t('modal_create_table.description', { dbType: dbType.toUpperCase() })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Designer */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="shrink-0 px-6 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="tableName" className="text-[12px] font-medium normal-case tracking-normal text-muted-foreground">{t('modal_create_table.field_label')}</Label>
                <Input 
                  id="tableName"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder={t('modal_create_table.placeholder')} 
                  className="h-9 border-border/70 text-[13px] focus-visible:ring-1 focus-visible:ring-primary/25"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-1 custom-scrollbar">
              <div className="space-y-4 pb-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[12px] font-medium text-muted-foreground">{t('modal_create_table.columns_label')}</h4>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={addColumn}
                    className="h-8 gap-2 rounded-md border-border/70 text-xs"
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
                        className="group relative flex flex-col gap-3 rounded-md bg-muted/25 p-3 transition-all hover:bg-muted/35"
                      >
                        <div className="flex items-center gap-2">
                          <div className="grid grid-cols-[1fr,160px] gap-2 flex-1">
                            <Input 
                              value={col.name}
                              onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                              placeholder={t('modal_create_table.column_name_placeholder')}
                              className="h-9 border-border/60 bg-background/80 text-[13px] focus-visible:ring-1 focus-visible:ring-primary/25"
                            />

                            <Select value={col.type} onValueChange={(val) => updateColumn(col.id, { type: val })}>
                              <SelectTrigger className="h-9 border-border/60 bg-background/80 text-xs">
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
                          <div className="flex h-9 items-center gap-4 rounded-md bg-background/70 px-3">
                            <div className="flex items-center gap-2" title={t("modal_create_table.column_primary")}>
                              <Checkbox 
                                id={`pk-${col.id}`}
                                checked={col.isPrimary} 
                                onCheckedChange={(val) => updateColumn(col.id, { isPrimary: !!val, isNullable: !val })} 
                                className="size-4 border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                              <Label htmlFor={`pk-${col.id}`} className="cursor-pointer transition-colors group-hover:text-foreground">{t('modal_create_table.column_primary')}</Label>
                            </div>
                            
                            <Separator orientation="vertical" className="h-4 bg-border/50" />

                            <div className="flex items-center gap-2" title={t("modal_create_table.column_nullable")}>
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
                            className="h-9 flex-1 border-border/60 bg-background/70 font-mono text-xs focus-visible:ring-1 focus-visible:ring-primary/25"
                          />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {error && (
                    <div className="flex items-start gap-3 rounded-md bg-destructive/10 p-3 text-destructive animate-in fade-in slide-in-from-top-1">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <div className="space-y-1">
                            <p className="text-[12px] font-medium">{t("explorer.engine_error")}</p>
                            <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{error}</p>
                        </div>
                    </div>
                )}
              </div>
            </div>
          </div>

          {/* SQL Preview Sidebar */}
          <div className="flex w-[300px] shrink-0 flex-col bg-muted/20 p-5">
            <div className="flex items-center gap-2 mb-4 opacity-70">
              <FileCode size={16} />
              <span className="text-[12px] font-medium text-muted-foreground">{t('modal_create_table.sql_preview')}</span>
            </div>

            <div className="flex-1 overflow-y-auto rounded-md bg-background/70 p-4 font-mono text-[10px] text-muted-foreground custom-scrollbar ring-1 ring-border/40">
              <pre className="whitespace-pre-wrap">{generatedSql}</pre>
            </div>

            <div className="mt-4 flex shrink-0 gap-2 rounded-md bg-amber-500/5 p-3">
              <AlertCircle size={14} className="text-amber-500 shrink-0" />
              <p className="text-[10px] text-amber-500/80 leading-snug">
                {t('modal_create_table.warn_modification')}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border/50 bg-muted/15 px-6 py-4">
          <Button variant="ghost" onClick={onClose} className="h-9 rounded-md px-4 text-[12px] font-medium text-muted-foreground">{t('common.cancel')}</Button>
          <Button 
            onClick={handleCreate}
            disabled={!tableName || columns.some(c => !c.name) || loading}
            className="h-9 min-w-[120px] rounded-md text-[12px] font-medium"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : t('modal_create_table.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
