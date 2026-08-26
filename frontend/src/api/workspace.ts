import { API_BASE_URL } from "../config";

export interface WorkspaceLoginResult {
  username: string;
  workspace: string;
  created: boolean;
}

let activeWorkspace = "";
const browserFetch = window.fetch.bind(window);

window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  if (!activeWorkspace) {
    return browserFetch(input, init);
  }

  const headers = new Headers(init.headers);
  headers.set("X-Workspace", activeWorkspace);

  return browserFetch(input, { ...init, headers });
};

export function setActiveWorkspace(workspace: string) {
  activeWorkspace = workspace;
}

export function getActiveWorkspace() {
  return activeWorkspace;
}

export async function loginToWorkspace(username: string): Promise<WorkspaceLoginResult> {
  const response = await browserFetch(`${API_BASE_URL}/api/workspaces/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const validationMessage = Array.isArray(data?.detail)
      ? data.detail[0]?.msg
      : data?.detail;
    throw new Error(validationMessage || "Unable to open workspace");
  }

  return data as WorkspaceLoginResult;
}
