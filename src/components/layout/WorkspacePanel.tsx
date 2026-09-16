import { ScrollArea } from "@/components/ui/scroll-area";
import { DatabaseExplorer } from "@/components/DatabaseExplorer";
import { EmptyWorkspace } from "./EmptyWorkspace";
import { WorkspaceTabs } from "./WorkspaceTabs";
import type { WorkspaceTab, WorkspaceTabStatePatch } from "@/domain/workspace/types";
import type { Connection } from "@/lib/useConnections";
import type { ForeignKeyNavigation } from "@/App";

interface WorkspacePanelProps {
  selectedConn: Connection | null;
  openTabs: WorkspaceTab[];
  activeTab: WorkspaceTab | null;
  activeTabId: string | null;
  openCreateTable: boolean;
  openCreateDatabase: boolean;
  onCreateConnection: () => void;
  onDisconnect: () => void;
  onTableSelected: (tableName: string | null) => void;
  foreignKeyNavigation: ForeignKeyNavigation | null;
  onForeignKeyNavigate: (tableName: string, whereClause: string) => void;
  onSelectTab: (tabId: string) => void;
  onWorkspaceTabChange: (tabId: string, patch: WorkspaceTabStatePatch) => void;
  onCloseTab: (tabId: string) => void;
  onCloseAllTables: () => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCloseTabsToRight: (tabId: string) => void;
  onModalOpened: () => void;
}

export function WorkspacePanel({
  selectedConn,
  openTabs,
  activeTab,
  activeTabId,
  openCreateTable,
  openCreateDatabase,
  onCreateConnection,
  onDisconnect,
  onTableSelected,
  foreignKeyNavigation,
  onForeignKeyNavigate,
  onSelectTab,
  onWorkspaceTabChange,
  onCloseTab,
  onCloseAllTables,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onModalOpened,
}: WorkspacePanelProps) {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-background">
      {selectedConn ? (
        <>
          <WorkspaceTabs
            tabs={openTabs}
            activeTabId={activeTabId}
            onSelect={onSelectTab}
            onClose={onCloseTab}
            onCloseAll={onCloseAllTables}
            onCloseOthers={onCloseOtherTabs}
            onCloseToRight={onCloseTabsToRight}
          />
          <DatabaseExplorer
            connection={selectedConn}
            onDisconnect={onDisconnect}
            openCreateOnMount={openCreateTable}
            openCreateDbOnMount={openCreateDatabase}
            workspaceTab={activeTab}
            onTableSelected={onTableSelected}
            onWorkspaceTabChange={onWorkspaceTabChange}
            foreignKeyNavigation={foreignKeyNavigation}
            onForeignKeyNavigate={onForeignKeyNavigate}
            onModalOpened={onModalOpened}
          />
        </>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <EmptyWorkspace onCreateConnection={onCreateConnection} />
        </ScrollArea>
      )}
    </section>
  );
}
