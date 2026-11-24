import { useEffect, useRef, useState } from "react";
import { Table2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { WorkspaceTab } from "@/domain/workspace/types";

export type { WorkspaceTab } from "@/domain/workspace/types";

interface WorkspaceTabsProps {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onCloseAll: () => void;
  onCloseOthers: (tabId: string) => void;
  onCloseToRight: (tabId: string) => void;
}

export function WorkspaceTabs({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onCloseAll,
  onCloseOthers,
  onCloseToRight,
}: WorkspaceTabsProps) {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
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

  useEffect(() => {
    if (!contextMenu) return;
    contextMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [contextMenu]);

  const openContextMenu = (event: React.MouseEvent<HTMLElement>, tabId: string) => {
    event.preventDefault();
    setContextMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 200)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 124)),
      tabId,
    });
  };

  if (tabs.length === 0) return null;

  return (
    <div aria-label={t("workspace_tabs.open_tables")} role="tablist" className="flex h-10 shrink-0 items-end overflow-x-auto overflow-y-hidden border-b border-border bg-chrome/60 px-1.5 [scrollbar-width:none]">
      <div className="flex h-full min-w-0 flex-1 items-end gap-px">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onContextMenu={(event) => openContextMenu(event, tab.id)}
              className={cn(
                "group/tab relative -mb-px flex h-[34px] w-56 min-w-28 shrink items-center gap-2 overflow-hidden rounded-t-md border-x border-t border-transparent pl-3 pr-1.5 text-[12px] text-muted-foreground transition-colors",
                active
                  ? "border-border bg-background text-foreground before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary"
                  : "hover:bg-foreground/[0.04] hover:text-foreground",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden outline-none"
                role="tab"
                aria-selected={active}
                aria-current={active ? "page" : undefined}
              >
                <Table2 size={14} className={cn("shrink-0", active && "text-primary")} />
                <span className="truncate font-medium">{tab.tableName}</span>
              </button>
              <button
                type="button"
                onClick={() => onClose(tab.id)}
                className={cn("flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground focus:opacity-100 group-hover/tab:opacity-100", active ? "opacity-100" : "opacity-0")}
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
          aria-label={t("workspace_tabs.context_menu")}
          className="fixed z-[100] min-w-48 rounded-lg border border-border bg-popover p-1 shadow-lg"
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
          <button
            type="button"
            role="menuitem"
            disabled={tabs.length < 2}
            onClick={() => {
              onCloseOthers(contextMenu.tabId);
              setContextMenu(null);
            }}
            className="flex h-8 w-full items-center rounded px-2.5 text-left text-[12px] text-foreground outline-none hover:bg-muted focus:bg-muted disabled:pointer-events-none disabled:opacity-40"
          >
            {t("workspace_tabs.close_others")}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={tabs.findIndex((tab) => tab.id === contextMenu.tabId) >= tabs.length - 1}
            onClick={() => {
              onCloseToRight(contextMenu.tabId);
              setContextMenu(null);
            }}
            className="flex h-8 w-full items-center rounded px-2.5 text-left text-[12px] text-foreground outline-none hover:bg-muted focus:bg-muted disabled:pointer-events-none disabled:opacity-40"
          >
            {t("workspace_tabs.close_right")}
          </button>
        </div>
      )}
    </div>
  );
}
