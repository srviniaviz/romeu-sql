import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Titlebar } from "./components/Titlebar";
import { CreateConnectionModal } from "./components/CreateConnection";
import { AppSidebar } from "./components/layout/AppSidebar";
import { ClusterManagerModal } from "./components/ClusterManagerModal";
import { DeleteConnectionDialog } from "./components/layout/DeleteConnectionDialog";
import { SettingsPage } from "./components/settings/SettingsPage";
import { ToastViewport } from "./components/ui/toast";
import { WorkspacePanel } from "./components/layout/WorkspacePanel";
import type { WorkspaceTab } from "./components/layout/WorkspaceTabs";
import { StartupAnimation } from "./components/StartupAnimation";
import { clearPasswordMemoryCache } from "./domain/connections/repository";
import { warmStronghold } from "./domain/connections/secretsRepository";
import { loadSettings } from "./domain/settings/repository";
import { DEFAULT_APP_SETTINGS } from "./domain/settings/types";
import { useSettings } from "./domain/settings/useSettings";
import { useConnections, Connection } from "./lib/useConnections";

const SIDEBAR_WIDTH_KEY = "romeu-sql:sidebar-width";
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 520;
type AppView = "workspace" | "settings";
export interface ForeignKeyNavigation {
  tableName: string;
  whereClause: string;
  token: number;
}

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
  const { settings } = useSettings();
  const appSettings = settings ?? DEFAULT_APP_SETTINGS;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<Connection | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [connToDelete, setConnToDelete] = useState<string | null>(null);
  const [selectedConn, setSelectedConn] = useState<Connection | null>(null);
  const [openTabs, setOpenTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [foreignKeyNavigation, setForeignKeyNavigation] = useState<ForeignKeyNavigation | null>(null);
  const [search, setSearch] = useState("");
  const [shouldOpenCreateModal, setShouldOpenCreateModal] = useState(false);
  const [shouldOpenCreateDbModal, setShouldOpenCreateDbModal] = useState(false);
  const [managingConn, setManagingConn] = useState<Connection | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth);
  const [activeView, setActiveView] = useState<AppView>("workspace");
  const [sidebarCollapseToken, setSidebarCollapseToken] = useState(0);
  const [showStartupAnimation, setShowStartupAnimation] = useState(true);

  const selectedTable = useMemo(
    () => openTabs.find((tab) => tab.id === activeTabId)?.tableName ?? null,
    [activeTabId, openTabs],
  );

  const finishStartupAnimation = useCallback(() => setShowStartupAnimation(false), []);

  useEffect(() => {
    if (connections.some((connection) => connection.hasSavedPassword)) {
      void warmStronghold();
    }
  }, [connections]);

  const visibleConnections = useMemo(() => {
    if (!selectedConn || !appSettings.connections.hideOtherConnectionsWhenConnected) return connections;
    return connections.filter((conn) => conn.id === selectedConn.id);
  }, [appSettings.connections.hideOtherConnectionsWhenConnected, connections, selectedConn]);

  const filteredConnections = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return visibleConnections;

    return visibleConnections.filter((conn) =>
      [conn.name, conn.host, conn.database, conn.type, conn.group]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)) ||
      (selectedConn?.id === conn.id)
    );
  }, [search, visibleConnections, selectedConn]);

  const selectOverview = () => {
    setActiveView("workspace");
    setSelectedConn(null);
    setActiveTabId(null);
    setOpenTabs([]);
    setForeignKeyNavigation(null);
  };

  const selectConnection = (conn: Connection) => {
    setActiveView("workspace");
    if (conn.id !== selectedConn?.id || conn.database !== selectedConn?.database) {
      setActiveTabId(null);
      setOpenTabs([]);
      setForeignKeyNavigation(null);
    }
    setSelectedConn(conn);
  };

  const openTable = (tableName: string, forceNew = false) => {
    const existingTab = forceNew
      ? undefined
      : openTabs.find((tab) => tab.id === activeTabId && tab.tableName === tableName) ??
        openTabs.find((tab) => tab.tableName === tableName);
    const nextTab = existingTab ?? { id: crypto.randomUUID(), tableName };

    if (!existingTab) {
      setOpenTabs((tabs) => [...tabs, nextTab]);
    }
    setActiveTabId(nextTab.id);
  };

  const selectTable = (table: string | null, connection?: Connection) => {
    setForeignKeyNavigation(null);
    if (!table) {
      setActiveTabId(null);
      return;
    }

    const connectionChanged = connection && (connection.id !== selectedConn?.id || connection.database !== selectedConn?.database);
    if (connectionChanged) {
      const nextTab = { id: crypto.randomUUID(), tableName: table };
      setSelectedConn(connection);
      setOpenTabs([nextTab]);
      setActiveTabId(nextTab.id);
      return;
    }

    openTable(table);
  };

  const openTableInNewTab = (conn: Connection, tableName: string) => {
    setActiveView("workspace");
    setForeignKeyNavigation(null);

    const connectionChanged = conn.id !== selectedConn?.id || conn.database !== selectedConn?.database;
    if (connectionChanged) {
      const nextTab = { id: crypto.randomUUID(), tableName };
      setSelectedConn(conn);
      setOpenTabs([nextTab]);
      setActiveTabId(nextTab.id);
      return;
    }

    openTable(tableName, true);
  };

  const closeTable = (tabId: string) => {
    const closingIndex = openTabs.findIndex((tab) => tab.id === tabId);
    if (closingIndex < 0) return;

    const remainingTabs = openTabs.filter((tab) => tab.id !== tabId);
    setOpenTabs(remainingTabs);
    setForeignKeyNavigation(null);

    if (activeTabId === tabId) {
      setActiveTabId(remainingTabs[closingIndex]?.id ?? remainingTabs[closingIndex - 1]?.id ?? null);
    }
  };

  const closeAllTables = () => {
    setOpenTabs([]);
    setActiveTabId(null);
    setForeignKeyNavigation(null);
  };

  const selectTab = (tabId: string) => {
    setForeignKeyNavigation(null);
    setActiveTabId(tabId);
  };

  const openForeignKey = (tableName: string, whereClause: string) => {
    openTable(tableName);
    setForeignKeyNavigation({ tableName, whereClause, token: Date.now() });
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
    const connectionId = selectedConn?.id;
    if (connectionId) {
      void loadSettings().then((settings) => {
        if (settings.security.clearSecretsOnDisconnect) {
          clearPasswordMemoryCache(connectionId);
        }
      });
    }
    setSidebarCollapseToken((token) => token + 1);
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
              totalConnections={connections.length}
              loading={loading}
              selectedConn={selectedConn}
              selectedTable={selectedTable}
              search={search}
              collapseToken={sidebarCollapseToken}
              onSearchChange={setSearch}
              onCreateConnection={openCreateConnection}
              onRefresh={() => refresh()}
              onSelectConnection={selectConnection}
              onSelectTable={selectTable}
              onOpenTableInNewTab={openTableInNewTab}
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
              openTabs={openTabs}
              activeTabId={activeTabId}
              openCreateTable={shouldOpenCreateModal}
              openCreateDatabase={shouldOpenCreateDbModal}
              onCreateConnection={openCreateConnection}
              onDisconnect={() => disconnect()}
              onTableSelected={selectTable}
              foreignKeyNavigation={foreignKeyNavigation}
              onForeignKeyNavigate={openForeignKey}
              onSelectTab={selectTab}
              onCloseTab={closeTable}
              onCloseAllTables={closeAllTables}
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
      <ToastViewport />
      {showStartupAnimation && <StartupAnimation onComplete={finishStartupAnimation} />}
    </div>
  );
}

export default App;
