import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SettingRow({
  icon: Icon,
  title,
  description,
  control,
}: {
  icon?: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(220px,320px)] items-start gap-10">
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={15} className="text-primary" />}
          <h3 className="text-[14px] font-semibold">{title}</h3>
        </div>
        <p className="max-w-xl text-[12px] leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{control}</div>
    </div>
  );
}

export function SettingToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <SettingRow
      title={title}
      description={description}
      control={
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={cn(
            "inline-flex h-7 w-12 items-center rounded-full p-1 transition-colors",
            checked ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "size-5 rounded-full bg-background shadow-sm transition-transform",
              checked && "translate-x-5"
            )}
          />
        </button>
      }
    />
  );
}

export function NumberInput({
  value,
  min,
  max,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  function commit() {
    const next = Math.round(Math.min(max, Math.max(min, localValue)));
    setLocalValue(next);
    onCommit(next);
  }

  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={localValue}
      onChange={(event) => setLocalValue(Number(event.target.value))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
      className="h-9 w-32"
    />
  );
}
