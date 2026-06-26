import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Delete connection?
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-5 text-muted-foreground">
            This removes the saved connection profile and its stored password.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-md">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="rounded-md">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
