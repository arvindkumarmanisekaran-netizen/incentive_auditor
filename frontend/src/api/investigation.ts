import type { InvestigationResult } from "../types/investigation";

export type WorkflowAgentStatus = "waiting" | "running" | "complete" | "error";

export type WorkflowEvent =
  | {
      type: "investigation_status";
      status: string;
      message?: string;
    }
  | {
      type: "agent_status";
      agent: string;
      status: WorkflowAgentStatus;
      timestamp?: string;
    }
  | {
      type: "commentary";
      agent: string;
      message: string;
      timestamp?: string;
    }
  | {
      type: "agent_result";
      agent: string;
      status?: WorkflowAgentStatus;
      output: unknown;
      timestamp?: string;
    };

export type WorkflowEventHandler = (event: WorkflowEvent) => void;

export async function runInvestigationStream(
  representativeId: string,
  startDate: string,
  endDate: string,
  onWorkflowEvent: WorkflowEventHandler,
): Promise<InvestigationResult> {
  const params = new URLSearchParams({
    representative_id: representativeId,
    start_date: startDate,
    end_date: endDate,
  });

  const response = await fetch(`/api/investigation/ai-summary-stream?${params.toString()}`, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
    },
  });

  if (!response.ok) {
    throw new Error(`Investigation failed with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Investigation stream returned no response body.");
  }

  const reader = response.body.getReader();

  const decoder = new TextDecoder("utf-8");

  let buffer = "";

  let finalResult: InvestigationResult | null = null;

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, {
      stream: true,
    });

    /*
     * SSE messages are separated by a blank line.
     */
    const blocks = buffer.split(/\r?\n\r?\n/);

    /*
     * Keep the final incomplete block for the next chunk.
     */
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      if (!block.trim()) {
        continue;
      }

      let eventName = "message";
      const dataLines: string[] = [];

      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith("event:")) {
          eventName = line.slice("event:".length).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice("data:".length).trim());
        }
      }

      if (dataLines.length === 0) {
        continue;
      }

      const rawData = dataLines.join("\n");

      let parsed: Record<string, unknown>;

      try {
        parsed = JSON.parse(rawData) as Record<string, unknown>;
      } catch (error) {
        console.error("Unable to parse investigation stream event:", rawData, error);

        continue;
      }

      /*
       * Live workflow events.
       */
      if (eventName === "workflow") {
        onWorkflowEvent(parsed as WorkflowEvent);

        continue;
      }

      /*
       * Final investigation result.
       */
      if (eventName === "result") {
        if (parsed?.type === "investigation_result" && parsed?.result) {
          finalResult = parsed.result as InvestigationResult;
        }

        continue;
      }

      /*
       * Backend-reported error.
       */
      if (eventName === "error") {
        const message = typeof parsed.message === "string"
          ? parsed.message
          : "Investigation workflow failed.";
        throw new Error(message);
      }
    }
  }

  if (!finalResult) {
    throw new Error("Investigation completed without returning a final result.");
  }

  return finalResult;
}
