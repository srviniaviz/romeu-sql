import { ScrollArea } from "@/components/ui/scroll-area";
import { DatabaseExplorer } from "@/components/DatabaseExplorer";
import { EmptyWorkspace } from "./EmptyWorkspace";
import { Connection } from "@/lib/useConnections";

interface WorkspacePanelProps {
  selectedConn: Connection | null;
  selectedTable: string | null;
  openCreateTable: boolean;
  openCreateDatabase: boolean;
  onCreateConnection: () => void;
  onDisconnect: () => void;
  onTableSelected: (tableName: string | null) => void;
  onModalOpened: () => void;
}

export function WorkspacePanel({
  selectedConn,
  selectedTable,
  openCreateTable,
  openCreateDatabase,
  onCreateConnection,
  onDisconnect,
  onTableSelected,
  onModalOpened,
}: WorkspacePanelProps) {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-background">
      {selectedConn ? (
        <DatabaseExplorer
          connection={selectedConn}
          onDisconnect={onDisconnect}
          openCreateOnMount={openCreateTable}
          openCreateDbOnMount={openCreateDatabase}
          selectedTable={selectedTable}
          onTableSelected={onTableSelected}
          onModalOpened={onModalOpened}
        />
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <EmptyWorkspace onCreateConnection={onCreateConnection} />
        </ScrollArea>
      )}
    </section>
  );
}
