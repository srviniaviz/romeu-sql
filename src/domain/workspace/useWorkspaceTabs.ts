import { useCallback, useMemo, useState } from "react";
import {
  closeOtherWorkspaceTabs,
  closeWorkspaceTab,
  closeWorkspaceTabsToRight,
} from "./workspaceTabs";
import {
  createWorkspaceTab,
  type DataViewMode,
  type WorkspaceTab,
  type WorkspaceTabStatePatch,
} from "./types";

interface UseWorkspaceTabsOptions {
  defaultPageSize: number;
  defaultViewMode: DataViewMode;
  queryLimit?: number;
}

interface WorkspaceTabsState {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
}

export function useWorkspaceTabs({
  defaultPageSize,
  defaultViewMode,
  queryLimit,
}: UseWorkspaceTabsOptions) {
  const [workspace, setWorkspace] = useState<WorkspaceTabsState>({ tabs: [], activeTabId: null });
  const { tabs, activeTabId } = workspace;

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, tabs],
  );

  const createTab = useCallback(
    (tableName: string) => createWorkspaceTab(tableName, {
      pageSize: defaultPageSize,
      viewMode: defaultViewMode,
      queryLimit,
    }),
    [defaultPageSize, defaultViewMode, queryLimit],
  );

  const openTable = useCallback((tableName: string, forceNew = false) => {
    setWorkspace((currentWorkspace) => {
      const existingTab = forceNew
        ? undefined
        : currentWorkspace.tabs.find((tab) => tab.id === currentWorkspace.activeTabId && tab.tableName === tableName) ??
          currentWorkspace.tabs.find((tab) => tab.tableName === tableName);
      const nextTab = existingTab ?? createTab(tableName);

      return existingTab
        ? { ...currentWorkspace, activeTabId: nextTab.id }
        : { tabs: [...currentWorkspace.tabs, nextTab], activeTabId: nextTab.id };
    });
  }, [createTab]);

  const replaceWithTable = useCallback((tableName: string) => {
    const nextTab = createTab(tableName);
    setWorkspace({ tabs: [nextTab], activeTabId: nextTab.id });
  }, [createTab]);

  const selectTab = useCallback((tabId: string | null) => {
    setWorkspace((currentWorkspace) => (
      tabId === null || currentWorkspace.tabs.some((tab) => tab.id === tabId)
        ? { ...currentWorkspace, activeTabId: tabId }
        : currentWorkspace
    ));
  }, []);

  const updateTab = useCallback((tabId: string, patch: WorkspaceTabStatePatch) => {
    setWorkspace((currentWorkspace) => ({
      ...currentWorkspace,
      tabs: currentWorkspace.tabs.map((tab) => {
        if (tab.id !== tabId) return tab;
        const nextPatch = typeof patch === "function" ? patch(tab.state) : patch;
        return { ...tab, state: { ...tab.state, ...nextPatch } };
      }),
    }));
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setWorkspace((currentWorkspace) => closeWorkspaceTab(
      currentWorkspace.tabs,
      currentWorkspace.activeTabId,
      tabId,
    ));
  }, []);

  const closeAll = useCallback(() => {
    setWorkspace({ tabs: [], activeTabId: null });
  }, []);

  const closeOthers = useCallback((tabId: string) => {
    setWorkspace((currentWorkspace) => closeOtherWorkspaceTabs(
      currentWorkspace.tabs,
      currentWorkspace.activeTabId,
      tabId,
    ));
  }, []);

  const closeToRight = useCallback((tabId: string) => {
    setWorkspace((currentWorkspace) => closeWorkspaceTabsToRight(
      currentWorkspace.tabs,
      currentWorkspace.activeTabId,
      tabId,
    ));
  }, []);

  return {
    tabs,
    activeTab,
    activeTabId,
    selectedTable: activeTab?.tableName ?? null,
    openTable,
    replaceWithTable,
    selectTab,
    updateTab,
    closeTab,
    closeAll,
    closeOthers,
    closeToRight,
  };
}

