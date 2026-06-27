import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface DeleteConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteConnectionDialog({
  open,
  onOpenChange,
  onConfirm,
}: DeleteConnectionDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm overflow-hidden rounded-lg border-border/60 bg-background p-0 shadow-2xl">
        <DialogHeader className="border-b border-border/50 px-6 py-5">
          <DialogTitle className="text-[16px] font-semibold tracking-tight text-foreground">
            {t("delete_connection.title")}
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-5 text-muted-foreground">
            {t("delete_connection.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-t border-border/50 bg-muted/15 px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-9 rounded-md px-4 text-[12px] font-medium text-muted-foreground">
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="h-9 rounded-md px-5 text-[12px] font-medium">
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
