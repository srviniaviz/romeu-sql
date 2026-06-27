import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

interface ToastPayload {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastItem extends ToastPayload {
  id: string;
  variant: ToastVariant;
}

const TOAST_EVENT = "romeu-sql:toast";
const TOAST_DURATION = 4200;

export function toast(payload: ToastPayload) {
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
}

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      const id = crypto.randomUUID();
      const item: ToastItem = {
        id,
        title: detail.title,
        description: detail.description,
        variant: detail.variant ?? "info",
      };
      setItems((current) => [...current.slice(-3), item]);
      window.setTimeout(() => {
        setItems((current) => current.filter((toastItem) => toastItem.id !== id));
      }, TOAST_DURATION);
    }

    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onClose={() => setItems((current) => current.filter((toastItem) => toastItem.id !== item.id))} />
      ))}
    </div>
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const Icon = item.variant === "success" ? CheckCircle2 : item.variant === "error" ? AlertCircle : Info;

  return (
    <div className="pointer-events-auto animate-in slide-in-from-bottom-2 fade-in-0 rounded-lg border border-border/70 bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
            item.variant === "success" && "bg-primary/10 text-primary",
            item.variant === "error" && "bg-destructive/10 text-destructive",
            item.variant === "info" && "bg-muted text-muted-foreground"
          )}
        >
          <Icon size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-5 text-foreground">{item.title}</p>
          {item.description && <p className="mt-0.5 line-clamp-3 text-[12px] leading-5 text-muted-foreground">{item.description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
