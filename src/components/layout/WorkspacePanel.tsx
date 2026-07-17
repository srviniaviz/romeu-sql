import { ScrollArea } from "@/components/ui/scroll-area";
import { DatabaseExplorer } from "@/components/DatabaseExplorer";
import { EmptyWorkspace } from "./EmptyWorkspace";
import { WorkspaceTabs } from "./WorkspaceTabs";
import { Connection } from "@/lib/useConnections";

interface WorkspacePanelProps {
  selectedConn: Connection | null;
  selectedTable: string | null;
  openTables: string[];
  openCreateTable: boolean;
  openCreateDatabase: boolean;
  onCreateConnection: () => void;
  onDisconnect: () => void;
  onTableSelected: (tableName: string | null) => void;
  onCloseTable: (tableName: string) => void;
  onCloseAllTables: () => void;
  onModalOpened: () => void;
}

export function WorkspacePanel({
  selectedConn,
  selectedTable,
  openTables,
  openCreateTable,
  openCreateDatabase,
  onCreateConnection,
  onDisconnect,
  onTableSelected,
  onCloseTable,
  onCloseAllTables,
  onModalOpened,
}: WorkspacePanelProps) {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-background">
      {selectedConn ? (
        <>
          <WorkspaceTabs
            tables={openTables}
            activeTable={selectedTable}
            onSelect={onTableSelected}
            onClose={onCloseTable}
            onCloseAll={onCloseAllTables}
          />
          <DatabaseExplorer
            connection={selectedConn}
            onDisconnect={onDisconnect}
            openCreateOnMount={openCreateTable}
            openCreateDbOnMount={openCreateDatabase}
            selectedTable={selectedTable}
            onTableSelected={onTableSelected}
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
