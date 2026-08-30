import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("window", { fetch: fetchMock });
});

describe("workspace API", () => {
  it("posts a username without a workspace header and stores the returned workspace", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ username: "Alice", workspace: "ws_123", created: true }),
    });
    const workspace = await import("./workspace");

    const result = await workspace.loginToWorkspace("Alice");
    workspace.setActiveWorkspace(result.workspace);

    expect(result).toEqual({ username: "Alice", workspace: "ws_123", created: true });
    expect(workspace.getActiveWorkspace()).toBe("ws_123");
    expect(fetchMock).toHaveBeenCalledWith("/api/workspaces/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Alice" }),
    });
  });

  it("adds the active workspace header to subsequent global fetches", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const workspace = await import("./workspace");
    workspace.setActiveWorkspace("ws_abc");

    await window.fetch("/api/sales", { headers: { Accept: "application/json" } });

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("X-Workspace")).toBe("ws_abc");
  });

  it.each([
    [{ detail: "Workspace unavailable" }, "Workspace unavailable"],
    [{ detail: [{ msg: "Name is too short" }] }, "Name is too short"],
    [null, "Unable to open workspace"],
  ])("normalizes login errors", async (payload, expected) => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => payload });
    const workspace = await import("./workspace");

    await expect(workspace.loginToWorkspace("Al")).rejects.toThrow(expected);
  });
});
