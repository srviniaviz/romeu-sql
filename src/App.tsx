import { useEffect, useMemo, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Titlebar } from "./components/Titlebar";
import { CreateConnectionModal } from "./components/CreateConnection";
import { AppSidebar } from "./components/layout/AppSidebar";
import { ClusterManagerModal } from "./components/ClusterManagerModal";
import { DeleteConnectionDialog } from "./components/layout/DeleteConnectionDialog";
import { SettingsPage } from "./components/settings/SettingsPage";
import { WorkspacePanel } from "./components/layout/WorkspacePanel";
import { warmStronghold } from "./domain/connections/secretsRepository";
import { useConnections, Connection } from "./lib/useConnections";

const SIDEBAR_WIDTH_KEY = "romeu-sql:sidebar-width";
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 520;
type AppView = "workspace" | "settings";

function clampSidebarWidth(value: number) {
  return Math.min(Math.max(value, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
}

function getInitialSidebarWidth() {
  const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
  return Number.isFinite(stored) && stored > 0 ? clampSidebarWidth(stored) : 300;
}

function App() {
  const { t } = useTranslation();
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
  const [managingConn, setManagingConn] = useState<Connection | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth);
  const [activeView, setActiveView] = useState<AppView>("workspace");

  useEffect(() => {
    if (connections.some((connection) => connection.hasSavedPassword)) {
      void warmStronghold();
    }
  }, [connections]);

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
    setActiveView("workspace");
    setSelectedConn(null);
    setSelectedTable(null);
  };

  const selectConnection = (conn: Connection) => {
    setActiveView("workspace");
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

  const openClusterManager = (conn: Connection, event: MouseEvent) => {
    event.stopPropagation();
    setSelectedConn(conn);
    setManagingConn(conn);
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

  const startSidebarResize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    let latestWidth = startWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const resize = (moveEvent: globalThis.PointerEvent) => {
      const nextWidth = clampSidebarWidth(startWidth + moveEvent.clientX - startX);
      latestWidth = nextWidth;
      setSidebarWidth(nextWidth);
    };

    const stopResize = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(latestWidth));
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stopResize);
    };

    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize, { once: true });
  };

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground font-sans text-[13px]">
      <Titlebar onOpenSettings={() => setActiveView("settings")} />

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {activeView === "settings" ? (
          <div className="min-w-0 flex-1">
            <SettingsPage onBack={() => setActiveView("workspace")} />
          </div>
        ) : (
          <>
            <AppSidebar
              width={sidebarWidth}
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
              onManageConnection={openClusterManager}
            />

            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t("shell.resize_sidebar")}
              className="group hidden w-1.5 shrink-0 cursor-col-resize items-stretch justify-center bg-muted/25 lg:flex"
              onPointerDown={startSidebarResize}
            >
              <div className="h-full w-px bg-border/40 transition-colors group-hover:bg-primary/60" />
            </div>

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
          </>
        )}
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

      <ClusterManagerModal
        connection={managingConn}
        open={!!managingConn}
        onOpenChange={(open) => {
          if (!open) setManagingConn(null);
        }}
      />
    </div>
  );
}

export default App;
