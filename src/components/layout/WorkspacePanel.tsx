import { ScrollArea } from "@/components/ui/scroll-area";
import { DatabaseExplorer } from "@/components/DatabaseExplorer";
import { EmptyWorkspace } from "./EmptyWorkspace";
import { WorkspaceTabs } from "./WorkspaceTabs";
import type { WorkspaceTab } from "./WorkspaceTabs";
import { Connection } from "@/lib/useConnections";
import type { ForeignKeyNavigation } from "@/App";

interface WorkspacePanelProps {
  selectedConn: Connection | null;
  selectedTable: string | null;
  openTabs: WorkspaceTab[];
  activeTabId: string | null;
  openCreateTable: boolean;
  openCreateDatabase: boolean;
  onCreateConnection: () => void;
  onDisconnect: () => void;
  onTableSelected: (tableName: string | null) => void;
  foreignKeyNavigation: ForeignKeyNavigation | null;
  onForeignKeyNavigate: (tableName: string, whereClause: string) => void;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseAllTables: () => void;
  onModalOpened: () => void;
}

export function WorkspacePanel({
  selectedConn,
  selectedTable,
  openTabs,
  activeTabId,
  openCreateTable,
  openCreateDatabase,
  onCreateConnection,
  onDisconnect,
  onTableSelected,
  foreignKeyNavigation,
  onForeignKeyNavigate,
  onSelectTab,
  onCloseTab,
  onCloseAllTables,
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
          />
          <DatabaseExplorer
            connection={selectedConn}
            onDisconnect={onDisconnect}
            openCreateOnMount={openCreateTable}
            openCreateDbOnMount={openCreateDatabase}
            selectedTable={selectedTable}
            onTableSelected={onTableSelected}
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
