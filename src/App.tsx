import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { Titlebar } from "./components/Titlebar";
import { CreateConnectionModal } from "./components/CreateConnection";
import { AppSidebar } from "./components/layout/AppSidebar";
import { DeleteConnectionDialog } from "./components/layout/DeleteConnectionDialog";
import { WorkspacePanel } from "./components/layout/WorkspacePanel";
import { useConnections, Connection } from "./lib/useConnections";

function App() {
  const { connections, loading, removeConnection, refresh } = useConnections();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<Connection | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [connToDelete, setConnToDelete] = useState<string | null>(null);
  const [selectedConn, setSelectedConn] = useState<Connection | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [shouldOpenCreateModal, setShouldOpenCreateModal] = useState(false);
  const [shouldOpenCreateDbModal, setShouldOpenCreateDbModal] = useState(false);

  const filteredConnections = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return connections;

    return connections.filter((conn) =>
      [conn.name, conn.host, conn.database, conn.type, conn.group]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [connections, search]);

  const selectOverview = () => {
    setSelectedConn(null);
    setSelectedTable(null);
  };

  const selectConnection = (conn: Connection) => {
    if (conn.id !== selectedConn?.id || conn.database !== selectedConn?.database) {
      setSelectedTable(null);
    }
    setSelectedConn(conn);
  };

  const openCreateConnection = () => setIsModalOpen(true);

  const openCreateTable = (conn: Connection) => {
    setSelectedConn(conn);
    setShouldOpenCreateModal(true);
  };

  const openCreateDatabase = (conn: Connection) => {
    setSelectedConn(conn);
    setShouldOpenCreateDbModal(true);
  };

  const editConnection = (conn: Connection, event: MouseEvent) => {
    event.stopPropagation();
    setEditingConn(conn);
    setIsModalOpen(true);
  };

  const disconnect = (event?: MouseEvent) => {
    event?.stopPropagation();
    selectOverview();
  };

  const requestDeleteConnection = (id: string, event: MouseEvent) => {
    event.stopPropagation();
    setConnToDelete(id);
    setIsDeleteOpen(true);
  };

  const confirmDeleteConnection = async () => {
    if (!connToDelete) return;
    await removeConnection(connToDelete);
    if (selectedConn?.id === connToDelete) {
      selectOverview();
    }
    setIsDeleteOpen(false);
    setConnToDelete(null);
  };

  const closeConnectionModal = () => {
    setIsModalOpen(false);
    setEditingConn(null);
  };

  const clearModalOpenFlags = () => {
    setShouldOpenCreateModal(false);
    setShouldOpenCreateDbModal(false);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground font-sans text-[13px]">
      <Titlebar />

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar
          connections={filteredConnections}
          loading={loading}
          selectedConn={selectedConn}
          selectedTable={selectedTable}
          search={search}
          onSearchChange={setSearch}
          onCreateConnection={openCreateConnection}
          onRefresh={() => refresh()}
          onSelectConnection={selectConnection}
          onSelectTable={setSelectedTable}
          onEdit={editConnection}
          onDelete={requestDeleteConnection}
          onDisconnect={disconnect}
          onCreateTable={openCreateTable}
          onCreateDatabase={openCreateDatabase}
        />

        <WorkspacePanel
          selectedConn={selectedConn}
          selectedTable={selectedTable}
          openCreateTable={shouldOpenCreateModal}
          openCreateDatabase={shouldOpenCreateDbModal}
          onCreateConnection={openCreateConnection}
          onDisconnect={() => disconnect()}
          onTableSelected={setSelectedTable}
          onModalOpened={clearModalOpenFlags}
        />
      </main>

      <CreateConnectionModal
        isOpen={isModalOpen}
        onClose={closeConnectionModal}
        connectionToEdit={editingConn}
      />

      <DeleteConnectionDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={confirmDeleteConnection}
      />
    </div>
  );
}

export default App;
