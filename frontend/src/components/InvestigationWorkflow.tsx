import { useEffect, useRef, useState } from "react";

import type { WorkflowAgent } from "../types/workflow";

type Props = {
  agents: WorkflowAgent[];
  loading: boolean;
  statusMessage: string;
};

function getStatusSymbol(status: WorkflowAgent["status"]) {
  switch (status) {
    case "running":
      return "●";

    case "complete":
      return "✓";

    case "error":
      return "✕";

    default:
      return "○";
  }
}

function getStatusLabel(status: WorkflowAgent["status"]) {
  switch (status) {
    case "running":
      return "Running";

    case "complete":
      return "Complete";

    case "error":
      return "Error";

    default:
      return "Waiting";
  }
}

function InvestigationWorkflow({ agents, loading, statusMessage }: Props) {
  const [expanded, setExpanded] = useState(true);

  /*
   * Keep refs for every workflow agent so we can
   * automatically scroll the active step into view.
   */
  const agentRefs = useRef<Record<string, HTMLElement | null>>({});
  const workflowSectionRef = useRef<HTMLElement | null>(null);

  const planner = agents.find((agent) => agent.id === "investigation_planner");

  const plannerOutput =
    planner?.output && typeof planner.output === "object"
      ? (planner.output as {
          priority?: string;
          focus_areas?: string[];
          reasoning?: string[];
        })
      : undefined;

  const completedCount = agents.filter((agent) => agent.status === "complete").length;

  const hasError = agents.some((agent) => agent.status === "error");

  const workflowComplete = agents.length > 0 && completedCount === agents.length;

  /*
   * Find the first currently-running agent
   * according to workflow display order.
   *
   * This behaves well with your parallel specialist
   * stage because it avoids jumping repeatedly between
   * Sales/Rx, Doctor/Territory and Payout.
   */
  const runningAgent = agents.find((agent) => agent.status === "running");

  // ==================================================
  // AUTO EXPAND WHILE INVESTIGATION IS RUNNING
  // ==================================================

  useEffect(() => {
    if (loading) {
      setExpanded(true);
    }
  }, [loading]);

  // ==================================================
  // AUTO COLLAPSE WHEN WORKFLOW COMPLETES
  // ==================================================

  useEffect(() => {
    if (workflowComplete && !loading) {
      setExpanded(false);

      const timer = window.setTimeout(() => {
        workflowSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        });
      }, 180);

      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [workflowComplete, loading]);

  // ==================================================
  // AUTO SCROLL TO CURRENT RUNNING AGENT
  // ==================================================

  useEffect(() => {
    if (!loading || !expanded || !runningAgent) {
      return;
    }

    const element = agentRefs.current[runningAgent.id];

    if (!element) {
      return;
    }

    /*
     * Small delay allows React to finish rendering
     * the status/commentary before scrolling.
     */
    const timer = window.setTimeout(() => {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [runningAgent?.id, loading, expanded]);

  // ==================================================
  // TOGGLE
  // ==================================================

  function handleToggle() {
    /*
     * Workflow must remain expanded while
     * investigation is actively running.
     */
    if (loading) {
      return;
    }

    setExpanded((current) => !current);
  }

  return (
    <section
      ref={workflowSectionRef}
      className="investigation-workflow"
    >
      {/* ==================================================
          WORKFLOW HEADER
      ================================================== */}

      <button
        type="button"
        className="investigation-workflow-header"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-disabled={loading}
      >
        <div className="investigation-workflow-header-main">
          <div className="investigation-workflow-title-row">
            <h2>Investigation Workflow</h2>

            {loading && <span className="workflow-live-badge">LIVE</span>}

            {!loading && workflowComplete && (
              <span className="workflow-complete-badge">Complete</span>
            )}

            {hasError && <span className="workflow-error-badge">Error</span>}
          </div>

          {statusMessage && <p className="investigation-workflow-status">{statusMessage}</p>}
        </div>

        <span className="investigation-workflow-toggle" aria-hidden="true">
          {loading ? "▲" : expanded ? "▲" : "▼"}
        </span>
      </button>

      {/* ==================================================
          PLANNER - ALWAYS VISIBLE
      ================================================== */}

      {planner && (
        <article
          ref={(element) => {
            agentRefs.current[planner.id] = element;
          }}
          className={`workflow-agent planner ${planner.status}`}
        >
          <div className="workflow-agent-header">
            <div className="workflow-agent-name">
              <span className={`workflow-status-icon ${planner.status}`} aria-hidden="true">
                {getStatusSymbol(planner.status)}
              </span>

              <h3>Investigation Planner</h3>
            </div>

            <span className={`workflow-step-status ${planner.status}`}>
              {getStatusLabel(planner.status)}
            </span>
          </div>

          {/* ----------------------------------------------
              PLANNER REASONING

              Structured planner output takes priority.
              While planner is still running, show live
              commentary instead.
          ---------------------------------------------- */}

          {plannerOutput?.reasoning && plannerOutput.reasoning.length > 0 ? (
            <div className="workflow-commentary">
              {plannerOutput.reasoning.map((reason, index) => (
                <div key={`planner-reason-${index}`} className="workflow-commentary-line">
                  <span className="workflow-commentary-marker">›</span>

                  <span>{reason}</span>
                </div>
              ))}
            </div>
          ) : planner.commentary.length > 0 ? (
            <div className="workflow-commentary">
              {planner.commentary.slice(-3).map((commentary, index) => (
                <div key={commentary.timestamp ?? index} className="workflow-commentary-line">
                  <span className="workflow-commentary-marker">›</span>

                  <span>{commentary.message}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="workflow-waiting-text">Waiting for investigation planner.</p>
          )}

          {/* ----------------------------------------------
              PLANNER DECISION
          ---------------------------------------------- */}

          {plannerOutput && (
            <div className="workflow-agent-result">
              <div className="workflow-plan-meta">
                <span>Priority</span>

                <strong>{plannerOutput.priority ?? "UNKNOWN"}</strong>
              </div>

              {plannerOutput.focus_areas && plannerOutput.focus_areas.length > 0 && (
                <div className="workflow-focus-areas">
                  {plannerOutput.focus_areas.map((area) => (
                    <span key={area} className="workflow-focus-pill">
                      {area.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </article>
      )}

      {/* ==================================================
          REST OF WORKFLOW - COLLAPSIBLE
      ================================================== */}

      {expanded && (
        <div className="investigation-workflow-body">
          {agents
            .filter((agent) => agent.id !== "investigation_planner")
            .map((agent) => {
              const latestCommentary = agent.commentary.slice(-3);

              return (
                <article
                  ref={(element) => {
                    agentRefs.current[agent.id] = element;
                  }}
                  key={agent.id}
                  className={`workflow-agent ${agent.status}`}
                >
                  <div className="workflow-agent-header">
                    <div className="workflow-agent-name">
                      <span className={`workflow-status-icon ${agent.status}`} aria-hidden="true">
                        {getStatusSymbol(agent.status)}
                      </span>

                      <h3>{agent.title}</h3>
                    </div>

                    <span className={`workflow-step-status ${agent.status}`}>
                      {getStatusLabel(agent.status)}
                    </span>
                  </div>

                  {latestCommentary.length > 0 ? (
                    <div className="workflow-commentary">
                      {latestCommentary.map((commentary, index) => (
                        <div
                          key={`${agent.id}-${index}-${commentary.timestamp ?? ""}`}
                          className="workflow-commentary-line"
                        >
                          <span className="workflow-commentary-marker">›</span>

                          <span>{commentary.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="workflow-waiting-text">
                      {agent.status === "waiting"
                        ? "Waiting for previous investigation stage."
                        : agent.status === "running"
                          ? "Processing..."
                          : ""}
                    </p>
                  )}
                </article>
              );
            })}
        </div>
      )}
    </section>
  );
}

export default InvestigationWorkflow;
