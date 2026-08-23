export type WorkflowStatus = "waiting" | "running" | "complete" | "error";

export type WorkflowCommentary = {
  message: string;
  timestamp?: string;
};

export type WorkflowAgent = {
  id: string;
  title: string;
  status: WorkflowStatus;
  commentary: WorkflowCommentary[];
  output?: unknown;
};
