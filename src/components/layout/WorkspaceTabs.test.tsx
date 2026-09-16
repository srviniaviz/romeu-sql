import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceTab } from "@/domain/workspace/types";
import { WorkspaceTabs } from "./WorkspaceTabs";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      "workspace_tabs.open_tables": "Open tables",
      "workspace_tabs.context_menu": "Tab actions",
      "workspace_tabs.close_others": "Close others",
      "workspace_tabs.close_right": "Close to the right",
      "workspace_tabs.close_all": "Close all tabs",
      "common.close": "Close",
    }[key] ?? key),
  }),
}));

afterEach(cleanup);

describe("WorkspaceTabs context menu", () => {
  it("targets the tab that opened the menu", () => {
    const onCloseOthers = vi.fn();
    const onCloseToRight = vi.fn();
    const tabs = [createWorkspaceTab("users"), createWorkspaceTab("orders")];

    render(
      <WorkspaceTabs
        tabs={tabs}
        activeTabId={tabs[0].id}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onCloseOthers={onCloseOthers}
        onCloseToRight={onCloseToRight}
        onCloseAll={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getAllByRole("tab")[0]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Close to the right" }));

    expect(onCloseToRight).toHaveBeenCalledWith(tabs[0].id);
    expect(onCloseOthers).not.toHaveBeenCalled();
  });

  it("disables actions that cannot affect another tab", () => {
    const tabs = [createWorkspaceTab("users")];

    render(
      <WorkspaceTabs
        tabs={tabs}
        activeTabId={tabs[0].id}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onCloseOthers={vi.fn()}
        onCloseToRight={vi.fn()}
        onCloseAll={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("tab"));

    expect(screen.getByRole("menuitem", { name: "Close others" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Close to the right" })).toBeDisabled();
  });
});

