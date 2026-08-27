import { useEffect, useRef, useState } from "react";
import AppIcon from "./AppIcon";
import { CustomDatePicker } from "./InvestigationForm";
import type { InvestigationResult } from "../types/investigation";

interface Props {
  representativeId: string;
  representativeName: string;
  startDate: string;
  endDate: string;
  result: InvestigationResult | null;
  onApplyFilters: (representativeId: string, startDate: string, endDate: string) => void;
  onInvestigationRequest: (representativeId: string, startDate: string, endDate: string) => Promise<InvestigationResult>;
}

interface ConversationMessage { role: "user" | "assistant"; content: string; }
interface Source { source: string; filters: string; record_count: number; access: string; }
interface DataResult { table: string; columns: string[]; records: Record<string, unknown>[]; }
interface ReportData {
  title: string; representative?: string; representative_id?: string; period?: string;
  risk_score?: number; severity?: string; products?: string[];
  findings?: Array<{ type: string; severity: string; product_id?: string; evidence?: Record<string, unknown> }>;
  executive_summary?: string; recommended_actions?: string[];
  selected_evidence?: EvidenceItem[];
}
interface EvidenceItem { type: string; severity: string; product_id?: string; evidence?: Record<string, unknown>; }
interface RootCauseDriver { finding: string; product: string; severity: string; strongest_metric: string; }
interface ReviewerCheck { status: string; label: string; detail: string; }
interface FindingSummaryItem { type: string; product: string; severity: string; evidence_count: number; }
interface PeerComparisonItem { scope: string; product: string; peer_group_size: number; sales_difference?: number; rx_difference?: number; payout_difference?: number; severity: string; }
interface ProactiveSignal { title: string; product: string; severity: string; reason: string; }
interface Playbook { name: string; steps: string[]; context_available?: boolean; }
interface ProposedAction { type: string; label: string; reason: string; representative_id: string; period: string; }
interface SavedSession { id: string; saved_at: string; representative_id: string; representative_name: string; start_date: string; end_date: string; result: InvestigationResult | null; selected_evidence: EvidenceItem[]; }
interface AssistantResponse {
  action?: string; message?: string; representative_id?: string; representative_name?: string;
  start_date?: string; end_date?: string; details?: string[]; data?: DataResult;
  report?: ReportData; sources?: Source[]; suggestions?: string[];
  finding?: EvidenceItem; drivers?: RootCauseDriver[]; hypotheses?: string[]; next_steps?: string[];
  checks?: ReviewerCheck[]; review_questions?: string[];
  focus?: { finding_type: string; product_id: string };
  severity_counts?: Record<string, number>; finding_items?: FindingSummaryItem[];
  peer_comparisons?: PeerComparisonItem[];
  display?: string; signals?: ProactiveSignal[]; playbooks?: Playbook[]; playbook?: Playbook;
  proposed_action?: ProposedAction; sessions?: SavedSession[];
}
interface ChatMessage { sender: "You" | "Copilot"; text: string; response?: AssistantResponse; }

function printableValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function escapeHtml(value: unknown) {
  return printableValue(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function humanLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function reportValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.map(reportValue).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${humanLabel(key)}: ${reportValue(item)}`)
      .join("; ");
  }
  return String(value);
}

function printReport(report: ReportData) {
  const popup = window.open("", "_blank", "width=980,height=760");
  if (!popup) return;
  const findings = (report.findings ?? []).map((finding) => `
    <section><h3>${escapeHtml(finding.type.replaceAll("_", " "))}</h3>
    <p><b>Severity:</b> ${escapeHtml(finding.severity)} &nbsp; <b>Product:</b> ${escapeHtml(finding.product_id ?? "All products")}</p>
    <div class="evidence">${Object.entries(finding.evidence ?? {}).map(([key, value]) => `<div><span>${escapeHtml(humanLabel(key))}</span><b>${escapeHtml(reportValue(value))}</b></div>`).join("") || "<p>No supporting metrics recorded.</p>"}</div></section>`).join("");
  const selectedEvidence = (report.selected_evidence ?? []).map((item) => `<li><b>${escapeHtml(humanLabel(item.type))}</b> · ${escapeHtml(item.product_id ?? "All products")} · ${escapeHtml(item.severity)}</li>`).join("");
  popup.document.write(`<!doctype html><html><head><title>${report.title}</title><style>
    body{font-family:Arial,sans-serif;color:#172033;margin:36px;line-height:1.5}h1{color:#1d4ed8}h3{text-transform:capitalize}
    .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.meta div,section{border:1px solid #dbe5f5;border-radius:10px;padding:14px}
    .evidence{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.evidence div{display:grid;gap:3px;background:#f7faff;border-radius:7px;padding:9px}.evidence span{color:#64748b;font-size:12px}.evidence b{overflow-wrap:anywhere;font-size:13px}@media print{body{margin:18px}.no-print{display:none}}
  </style></head><body><button class="no-print" onclick="window.print()">Print</button><h1>${report.title}</h1>
  <div class="meta"><div><b>Representative</b><br>${escapeHtml(report.representative ?? report.representative_id ?? "—")}</div><div><b>Period</b><br>${escapeHtml(report.period ?? "—")}</div><div><b>Risk</b><br>${escapeHtml(report.risk_score ?? "—")} · ${escapeHtml(report.severity ?? "—")}</div></div>
  ${report.executive_summary ? `<section><h2>Executive summary</h2><p>${escapeHtml(report.executive_summary)}</p></section>` : ""}
  <h2>Findings</h2>${findings || "<p>No findings recorded.</p>"}
  ${selectedEvidence ? `<section><h2>Evidence selected by investigator</h2><ul>${selectedEvidence}</ul></section>` : ""}
  <section><h2>Recommended actions</h2><ul>${(report.recommended_actions ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>None recorded</li>"}</ul></section>
  <p><small>Generated from the current investigation context. Verify evidence before taking action.</small></p></body></html>`);
  popup.document.close();
  popup.opener = null;
}

export default function AIChatAssistant({ representativeId, representativeName, startDate, endDate, result, onApplyFilters, onInvestigationRequest }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestedStartDate, setRequestedStartDate] = useState(startDate);
  const [requestedEndDate, setRequestedEndDate] = useState(endDate);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem[]>([]);
  const [focusedFinding, setFocusedFinding] = useState<EvidenceItem | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" }); }, [chat, loading]);
  useEffect(() => {
    if (!open || loading) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, loading]);

  function addEvidence(item?: EvidenceItem) {
    if (!item) return;
    setSelectedEvidence((current) => {
      const exists = current.some((entry) => entry.type === item.type && entry.product_id === item.product_id);
      return exists ? current : [...current, item];
    });
  }

  function isEvidenceSelected(item?: EvidenceItem) {
    return Boolean(item && selectedEvidence.some((entry) => entry.type === item.type && entry.product_id === item.product_id));
  }

  function focusAnalysis() {
    const target = document.querySelector<HTMLElement>(".analysis-workspace");
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.classList.add("assistant-chart-focus");
    window.setTimeout(() => target.classList.remove("assistant-chart-focus"), 1800);
  }

  async function sendMessage(value = message) {
    const userMessage = value.trim();
    if (!userMessage || loading) return;
    setMessage("");
    setChat((current) => [...current, { sender: "You", text: userMessage }]);
    const updatedConversation: ConversationMessage[] = [...conversation, { role: "user", content: userMessage }];
    setConversation(updatedConversation);
    const lowered = userMessage.toLowerCase();
    if (lowered.includes("saved investigation") || lowered.includes("saved session")) {
      const sessions = JSON.parse(window.localStorage.getItem("incentive-copilot-sessions") ?? "[]") as SavedSession[];
      setChat((current) => [...current, { sender: "Copilot", text: sessions.length ? `You have ${sessions.length} saved investigation session(s).` : "No investigation sessions have been saved yet.", response: { action: "SAVED_SESSIONS", sessions } }]);
      setConversation((current) => [...current, { role: "assistant", content: `${sessions.length} saved investigation sessions.` }]);
      return;
    }
    if (lowered.includes("save") && (lowered.includes("session") || lowered.includes("investigation"))) {
      setChat((current) => [...current, { sender: "Copilot", text: "Review the investigation scope before saving this session.", response: { action: "CONFIRM_SAVE_SESSION" } }]);
      setConversation((current) => [...current, { role: "assistant", content: "Review the investigation scope before saving this session." }]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/chat/investigation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, conversation: updatedConversation, context: {
          representative_id: representativeId || null, representative_name: representativeName || null,
          start_date: startDate || null, end_date: endDate || null, result,
          selected_evidence: selectedEvidence,
          focused_finding: focusedFinding,
        } }),
      });
      if (!response.ok) throw new Error("Assistant service unavailable");
      const data = await response.json() as AssistantResponse;
      const assistantText = data.message ?? "Request processed.";
      if (data.finding) setFocusedFinding(data.finding);
      setChat((current) => [...current, { sender: "Copilot", text: assistantText, response: data }]);
      setConversation((current) => [...current, { role: "assistant", content: assistantText }]);
    } catch (error) {
      setChat((current) => [...current, { sender: "Copilot", text: error instanceof Error ? error.message : "Unable to process the request." }]);
    } finally { setLoading(false); }
  }

  async function applyAndRun(response: AssistantResponse) {
    if (!response.representative_id || !response.start_date || !response.end_date) return;
    onApplyFilters(response.representative_id, response.start_date, response.end_date);
    setChat((current) => [...current, { sender: "Copilot", text: "Filters applied. Starting the confirmed investigation." }]);
    setLoading(true);
    try {
      await onInvestigationRequest(response.representative_id, response.start_date, response.end_date);
      setChat((current) => [...current, { sender: "Copilot", text: "Investigation completed. You can now ask me to explain a finding or print the summary." }]);
      setChat((current) => [...current, { sender: "Copilot", text: "Phase 3 suggestion: run a proactive scan, choose a playbook, or save this investigation session.", response: { suggestions: ["Run proactive scan", "Show investigation playbooks", "Save this investigation session"] } }]);
    } catch { setChat((current) => [...current, { sender: "Copilot", text: "The investigation could not be completed." }]); }
    finally { setLoading(false); }
  }

  function renderResponse(response?: AssistantResponse) {
    if (!response) return null;
    return <>
      {response.action === "PROPOSE_FILTERS" && <div className="assistant-action-card">
        <span><b>{response.representative_name}</b><small>{response.representative_id}</small></span>
        <span><b>{response.start_date}</b><small>Start date</small></span><span><b>{response.end_date}</b><small>End date</small></span>
        <div className="assistant-card-actions"><button onClick={() => { if (response.representative_id && response.start_date && response.end_date) onApplyFilters(response.representative_id, response.start_date, response.end_date); }}>Apply to form</button><button className="primary" onClick={() => void applyAndRun(response)}>Apply & run</button></div>
      </div>}
      {(response.action === "NEED_DATE" || response.message?.toLowerCase().includes("month or date range")) && <div className="assistant-date-request">
        <label><span>Start date</span><CustomDatePicker value={requestedStartDate} onChange={setRequestedStartDate} ariaLabel="Select assistant investigation start date" /></label>
        <label><span>End date</span><CustomDatePicker value={requestedEndDate} onChange={setRequestedEndDate} ariaLabel="Select assistant investigation end date" /></label>
        <button type="button" disabled={!requestedStartDate || !requestedEndDate || requestedStartDate > requestedEndDate} onClick={() => void sendMessage(`${requestedStartDate} to ${requestedEndDate}`)}>Continue with dates</button>
        {requestedStartDate && requestedEndDate && requestedStartDate > requestedEndDate && <small>End date must be on or after the start date.</small>}
      </div>}
      {response.drivers && <div className="assistant-phase2-card"><b>Leading analytical drivers</b>{response.drivers.map((driver) => <div key={`${driver.finding}-${driver.product}`}><span>{driver.finding} · {driver.product}</span><strong className={`severity-${driver.severity.toLowerCase()}`}>{driver.severity}</strong><small>{driver.strongest_metric}</small></div>)}</div>}
      {response.hypotheses && <div className="assistant-hypotheses"><b>Hypotheses to verify</b><ul>{response.hypotheses.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {response.checks && <div className="assistant-phase2-card"><b>Reviewer checks</b>{response.checks.map((check) => <div key={check.label}><span>{check.label}</span><strong className={`review-${check.status}`}>{check.status}</strong><small>{check.detail}</small></div>)}</div>}
      {response.review_questions && <div className="assistant-hypotheses"><b>Reviewer questions</b><ul>{response.review_questions.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {response.severity_counts && <div className="assistant-severity-summary">{Object.entries(response.severity_counts).map(([severity, count]) => <span key={severity}><b>{count}</b>{severity}</span>)}</div>}
      {response.finding_items && <details className="assistant-result-details"><summary>View all {response.finding_items.length} findings</summary><div className="assistant-phase2-card">{response.finding_items.map((item, index) => <div key={`${item.type}-${item.product}-${index}`}><span>{item.type} · {item.product}</span><strong className={`severity-${item.severity.toLowerCase()}`}>{item.severity}</strong><small>{item.evidence_count} supporting metric(s)</small></div>)}</div></details>}
      {response.peer_comparisons && response.display !== "table" && <details className="assistant-result-details"><summary>View {response.peer_comparisons.length} peer comparisons</summary><div className="assistant-phase2-card">{response.peer_comparisons.map((item, index) => <div key={`${item.scope}-${item.product}-${index}`}><span>{item.product} · {item.scope}</span><strong className={`severity-${item.severity.toLowerCase()}`}>{item.severity}</strong><small>Sales {item.sales_difference ?? "—"}% · Rx {item.rx_difference ?? "—"}% · Payout {item.payout_difference ?? "—"}% · {item.peer_group_size} peers</small></div>)}</div></details>}
      {response.peer_comparisons && response.display === "table" && <div className="assistant-data-wrap"><div className="assistant-data-title"><b>Peer comparison table</b><span>{response.peer_comparisons.length} rows</span></div><div className="assistant-data-scroll"><table><thead><tr><th>Product</th><th>Scope</th><th>Sales %</th><th>Rx %</th><th>Payout %</th><th>Peers</th></tr></thead><tbody>{response.peer_comparisons.map((item, index) => <tr key={`${item.product}-${index}`}><td>{item.product}</td><td>{item.scope}</td><td>{item.sales_difference ?? "—"}</td><td>{item.rx_difference ?? "—"}</td><td>{item.payout_difference ?? "—"}</td><td>{item.peer_group_size}</td></tr>)}</tbody></table></div></div>}
      {response.signals && <div className="assistant-phase2-card"><b>Proactive signals</b>{response.signals.map((signal) => <div key={`${signal.title}-${signal.product}`}><span>{signal.title} · {signal.product}</span><strong className={`severity-${signal.severity.toLowerCase()}`}>{signal.severity}</strong><small>{signal.reason}</small></div>)}</div>}
      {response.playbooks && <div className="assistant-playbooks">{response.playbooks.map((playbook) => <button key={playbook.name} type="button" onClick={() => void sendMessage(`Run ${playbook.name} playbook`)}><b>{playbook.name}</b><small>{playbook.steps.length} governed steps</small></button>)}</div>}
      {response.playbook && <div className="assistant-hypotheses"><b>{response.playbook.name}</b><ol>{response.playbook.steps.map((step) => <li key={step}>{step}</li>)}</ol></div>}
      {response.action === "CONFIRM_SAVE_SESSION" && <div className="assistant-confirm-card"><b>Save investigation session</b><span>{representativeName || representativeId} · {startDate} to {endDate}</span><button type="button" disabled={!result} onClick={() => {
        const sessions = JSON.parse(window.localStorage.getItem("incentive-copilot-sessions") ?? "[]") as SavedSession[];
        const session: SavedSession = { id: `${representativeId}-${Date.now()}`, saved_at: new Date().toISOString(), representative_id: representativeId, representative_name: representativeName, start_date: startDate, end_date: endDate, result, selected_evidence: selectedEvidence };
        window.localStorage.setItem("incentive-copilot-sessions", JSON.stringify([session, ...sessions].slice(0, 20)));
        setChat((current) => [...current, { sender: "Copilot", text: "Investigation session saved locally with its evidence collection." }]);
      }}>Confirm save</button></div>}
      {response.sessions && <div className="assistant-saved-sessions">{response.sessions.map((session) => <div key={session.id}><b>{session.representative_name || session.representative_id}</b><span>{session.start_date} to {session.end_date}</span><small>Saved {new Date(session.saved_at).toLocaleString()} · {session.selected_evidence.length} evidence item(s)</small></div>)}</div>}
      {response.proposed_action && <div className="assistant-confirm-card"><b>{response.proposed_action.label}</b><span>{response.proposed_action.representative_id} · {response.proposed_action.period}</span><small>{response.proposed_action.reason}</small><button type="button" onClick={() => setChat((current) => [...current, { sender: "Copilot", text: "Confirmed: this investigation is marked for human review in the current copilot session. No database record was modified." }])}>Confirm action</button></div>}
      {response.focus && <button className="assistant-focus-button" type="button" onClick={focusAnalysis}>Focus chart · {humanLabel(response.focus.finding_type)}</button>}
      {response.finding && <button className="assistant-evidence-button" type="button" disabled={isEvidenceSelected(response.finding)} onClick={() => addEvidence(response.finding)}>{isEvidenceSelected(response.finding) ? "Added to evidence collection" : "Add to evidence collection"}</button>}
      {response.details && <ul className="assistant-detail-list">{response.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
      {response.data && <div className="assistant-data-wrap"><div className="assistant-data-title"><b>{response.data.table.replaceAll("_", " ")}</b><span>{response.data.records.length} rows</span></div><div className="assistant-data-scroll"><table><thead><tr>{response.data.columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{response.data.records.map((record, rowIndex) => <tr key={rowIndex}>{response.data!.columns.map((column) => <td key={column}>{printableValue(record[column])}</td>)}</tr>)}</tbody></table></div></div>}
      {response.report && <button className="assistant-print-button" onClick={() => printReport(response.report!)}>Open printable summary</button>}
      {selectedEvidence.length > 0 && response.action === "PRINT_SUMMARY" && <div className="assistant-evidence-count">{selectedEvidence.length} selected evidence item(s) included</div>}
      {response.sources && <details className="assistant-sources"><summary>Evidence & sources ({response.sources.length})</summary>{response.sources.map((source, index) => <div key={`${source.source}-${index}`}><b>{source.source}</b><span>{source.filters}</span><small>{source.record_count} record(s) · {source.access}</small></div>)}</details>}
      {response.suggestions && <div className="assistant-suggestions">{response.suggestions.map((suggestion) => <button key={suggestion} onClick={() => suggestion.toLowerCase() === "add this evidence" && response.finding ? addEvidence(response.finding) : void sendMessage(suggestion)}>{suggestion}</button>)}</div>}
    </>;
  }

  return <>
    <button type="button" className="chatbot-floating-button" onClick={() => setOpen((current) => !current)} aria-label="Open AI investigation assistant"><AppIcon name="assistant" size={25} /></button>
    {open && <div className="chatbot-window">
      <div className="chatbot-header"><AppIcon name="assistant" size={20} /><div><span>Investigation Copilot</span><small>Read-only data access · Confirmed actions</small></div></div>
      <div className="chatbot-messages" ref={messagesRef}>
        {chat.length === 0 && <div className="chatbot-placeholder"><strong>Ask anything · Examples</strong><span>“Investigate Steve for July 2026”</span><span>“Show active representatives”</span><span>“Explain the current finding”</span><span>“Print investigation summary”</span></div>}
        {chat.map((item, index) => <div key={`${item.sender}-${index}`} className={item.sender === "You" ? "chat-user-message" : "chat-agent-message"}><strong>{item.sender}</strong><p>{item.text}</p>{renderResponse(item.response)}</div>)}
        {loading && <div className="chat-agent-message assistant-thinking"><span /> Thinking with investigation context…</div>}
      </div>
      <div className="chatbot-input"><input ref={inputRef} value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendMessage(); }} placeholder="Ask, query, explain or print…" disabled={loading} /><button type="button" onClick={() => void sendMessage()} disabled={loading}>Send</button></div>
    </div>}
  </>;
}
