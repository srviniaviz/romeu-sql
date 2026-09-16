import type { WorkspaceTab } from "./types";

export interface WorkspaceTabsResult {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
}

export function closeWorkspaceTab(
  tabs: WorkspaceTab[],
  activeTabId: string | null,
  tabId: string,
): WorkspaceTabsResult {
  const closingIndex = tabs.findIndex((tab) => tab.id === tabId);
  if (closingIndex < 0) return { tabs, activeTabId };

  const remainingTabs = tabs.filter((tab) => tab.id !== tabId);
  const nextActiveTabId = activeTabId === tabId
    ? remainingTabs[closingIndex]?.id ?? remainingTabs[closingIndex - 1]?.id ?? null
    : activeTabId;

  return { tabs: remainingTabs, activeTabId: nextActiveTabId };
}

export function closeOtherWorkspaceTabs(
  tabs: WorkspaceTab[],
  activeTabId: string | null,
  tabId: string,
): WorkspaceTabsResult {
  const targetTab = tabs.find((tab) => tab.id === tabId);
  if (!targetTab) return { tabs, activeTabId };

  return { tabs: [targetTab], activeTabId: targetTab.id };
}

export function closeWorkspaceTabsToRight(
  tabs: WorkspaceTab[],
  activeTabId: string | null,
  tabId: string,
): WorkspaceTabsResult {
  const targetIndex = tabs.findIndex((tab) => tab.id === tabId);
  if (targetIndex < 0) return { tabs, activeTabId };

  const remainingTabs = tabs.slice(0, targetIndex + 1);
  const activeTabWasClosed = activeTabId !== null && !remainingTabs.some((tab) => tab.id === activeTabId);

  return {
    tabs: remainingTabs,
    activeTabId: activeTabWasClosed ? tabId : activeTabId,
  };
}

