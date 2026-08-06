import { useEffect, useRef, useState } from "react";
import { Table2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface WorkspaceTab {
  id: string;
  tableName: string;
}

interface WorkspaceTabsProps {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onCloseAll: () => void;
}

export function WorkspaceTabs({ tabs, activeTabId, onSelect, onClose, onCloseAll }: WorkspaceTabsProps) {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;

    const closeMenu = (event: PointerEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  const openContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    setContextMenu({
      x: Math.min(event.clientX, window.innerWidth - 200),
      y: Math.min(event.clientY, window.innerHeight - 52),
    });
  };

  if (tabs.length === 0) return null;

  return (
    <nav aria-label="Open tables" onContextMenu={openContextMenu} className="flex h-11 shrink-0 items-end overflow-visible border-b border-border/50 bg-muted/20 px-2">
      <div className="flex h-full min-w-0 flex-1 items-end">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={cn(
                "group/tab flex h-9 w-64 min-w-0 shrink items-center gap-2 overflow-hidden border-x border-t border-transparent px-3 text-[12px] text-muted-foreground transition-colors",
                active
                  ? "rounded-t-md border-border bg-background text-foreground"
                  : "hover:bg-muted/45 hover:text-foreground",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden outline-none"
                aria-current={active ? "page" : undefined}
              >
                <Table2 size={14} className={cn("shrink-0", active && "text-primary")} />
                <span className="truncate font-medium">{tab.tableName}</span>
              </button>
              <button
                type="button"
                onClick={() => onClose(tab.id)}
                className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-colors hover:bg-muted hover:text-foreground focus:opacity-100 group-hover/tab:opacity-100"
                aria-label={`${t("common.close")} ${tab.tableName}`}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
      {contextMenu && (
        <div
          ref={contextMenuRef}
          role="menu"
          className="fixed z-[100] min-w-48 rounded-md border border-border bg-popover p-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onCloseAll();
              setContextMenu(null);
            }}
            className="flex h-8 w-full items-center rounded px-2.5 text-left text-[12px] text-foreground outline-none hover:bg-muted focus:bg-muted"
          >
            {t("workspace_tabs.close_all")}
          </button>
        </div>
      )}
    </nav>
  );
}
