import { describe, expect, it } from "vitest";
import { createWorkspaceTab } from "./types";
import {
  closeOtherWorkspaceTabs,
  closeWorkspaceTab,
  closeWorkspaceTabsToRight,
} from "./workspaceTabs";

describe("workspace table sessions", () => {
  it("creates independent state for repeated openings of the same table", () => {
    const first = createWorkspaceTab("users");
    const second = createWorkspaceTab("users");

    first.state.page = 3;
    first.state.whereClause = "active = true";
    first.state.queryRows = [{ id: 1 }];

    expect(second.id).not.toBe(first.id);
    expect(second.state.page).toBe(0);
    expect(second.state.whereClause).toBe("");
    expect(second.state.queryRows).toEqual([]);
  });

  it("selects the next tab when the active tab is closed", () => {
    const tabs = [createWorkspaceTab("users"), createWorkspaceTab("orders"), createWorkspaceTab("events")];
    const result = closeWorkspaceTab(tabs, tabs[1].id, tabs[1].id);

    expect(result.tabs.map((tab) => tab.tableName)).toEqual(["users", "events"]);
    expect(result.activeTabId).toBe(tabs[2].id);
  });

  it("keeps only the context-menu target when closing other tabs", () => {
    const tabs = [createWorkspaceTab("users"), createWorkspaceTab("orders"), createWorkspaceTab("events")];
    const result = closeOtherWorkspaceTabs(tabs, tabs[0].id, tabs[1].id);

    expect(result.tabs.map((tab) => tab.tableName)).toEqual(["orders"]);
    expect(result.activeTabId).toBe(tabs[1].id);
  });

  it("closes tabs to the right and activates the target if needed", () => {
    const tabs = [createWorkspaceTab("users"), createWorkspaceTab("orders"), createWorkspaceTab("events")];
    const result = closeWorkspaceTabsToRight(tabs, tabs[2].id, tabs[1].id);

    expect(result.tabs.map((tab) => tab.tableName)).toEqual(["users", "orders"]);
    expect(result.activeTabId).toBe(tabs[1].id);
  });
});

