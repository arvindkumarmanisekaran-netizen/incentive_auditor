import { useEffect, useRef, useState } from "react";
import AppIcon from "./AppIcon";
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
}
interface AssistantResponse {
  action?: string; message?: string; representative_id?: string; representative_name?: string;
  start_date?: string; end_date?: string; details?: string[]; data?: DataResult;
  report?: ReportData; sources?: Source[]; suggestions?: string[];
}
interface ChatMessage { sender: "You" | "Assistant"; text: string; response?: AssistantResponse; }

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

function printReport(report: ReportData) {
  const popup = window.open("", "_blank", "width=980,height=760");
  if (!popup) return;
  const findings = (report.findings ?? []).map((finding) => `
    <section><h3>${escapeHtml(finding.type.replaceAll("_", " "))}</h3>
    <p><b>Severity:</b> ${escapeHtml(finding.severity)} &nbsp; <b>Product:</b> ${escapeHtml(finding.product_id ?? "All products")}</p>
    <pre>${escapeHtml(JSON.stringify(finding.evidence ?? {}, null, 2))}</pre></section>`).join("");
  popup.document.write(`<!doctype html><html><head><title>${report.title}</title><style>
    body{font-family:Arial,sans-serif;color:#172033;margin:36px;line-height:1.5}h1{color:#1d4ed8}h3{text-transform:capitalize}
    .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.meta div,section{border:1px solid #dbe5f5;border-radius:10px;padding:14px}
    pre{white-space:pre-wrap;background:#f7faff;padding:10px;border-radius:8px}@media print{body{margin:18px}.no-print{display:none}}
  </style></head><body><button class="no-print" onclick="window.print()">Print</button><h1>${report.title}</h1>
  <div class="meta"><div><b>Representative</b><br>${escapeHtml(report.representative ?? report.representative_id ?? "—")}</div><div><b>Period</b><br>${escapeHtml(report.period ?? "—")}</div><div><b>Risk</b><br>${escapeHtml(report.risk_score ?? "—")} · ${escapeHtml(report.severity ?? "—")}</div></div>
  ${report.executive_summary ? `<section><h2>Executive summary</h2><p>${escapeHtml(report.executive_summary)}</p></section>` : ""}
  <h2>Findings</h2>${findings || "<p>No findings recorded.</p>"}
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
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" }); }, [chat, loading]);

  async function sendMessage(value = message) {
    const userMessage = value.trim();
    if (!userMessage || loading) return;
    setMessage("");
    setChat((current) => [...current, { sender: "You", text: userMessage }]);
    const updatedConversation: ConversationMessage[] = [...conversation, { role: "user", content: userMessage }];
    setConversation(updatedConversation);
    setLoading(true);
    try {
      const response = await fetch("/api/chat/investigation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, conversation: updatedConversation, context: {
          representative_id: representativeId || null, representative_name: representativeName || null,
          start_date: startDate || null, end_date: endDate || null, result,
        } }),
      });
      if (!response.ok) throw new Error("Assistant service unavailable");
      const data = await response.json() as AssistantResponse;
      const assistantText = data.message ?? "Request processed.";
      setChat((current) => [...current, { sender: "Assistant", text: assistantText, response: data }]);
      setConversation((current) => [...current, { role: "assistant", content: assistantText }]);
    } catch (error) {
      setChat((current) => [...current, { sender: "Assistant", text: error instanceof Error ? error.message : "Unable to process the request." }]);
    } finally { setLoading(false); }
  }

  async function applyAndRun(response: AssistantResponse) {
    if (!response.representative_id || !response.start_date || !response.end_date) return;
    onApplyFilters(response.representative_id, response.start_date, response.end_date);
    setChat((current) => [...current, { sender: "Assistant", text: "Filters applied. Starting the confirmed investigation." }]);
    setLoading(true);
    try {
      await onInvestigationRequest(response.representative_id, response.start_date, response.end_date);
      setChat((current) => [...current, { sender: "Assistant", text: "Investigation completed. You can now ask me to explain a finding or print the summary." }]);
    } catch { setChat((current) => [...current, { sender: "Assistant", text: "The investigation could not be completed." }]); }
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
      {response.details && <ul className="assistant-detail-list">{response.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
      {response.data && <div className="assistant-data-wrap"><div className="assistant-data-title"><b>{response.data.table.replaceAll("_", " ")}</b><span>{response.data.records.length} rows</span></div><div className="assistant-data-scroll"><table><thead><tr>{response.data.columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{response.data.records.map((record, rowIndex) => <tr key={rowIndex}>{response.data!.columns.map((column) => <td key={column}>{printableValue(record[column])}</td>)}</tr>)}</tbody></table></div></div>}
      {response.report && <button className="assistant-print-button" onClick={() => printReport(response.report!)}><AppIcon name="file" size={16} /> Open printable summary</button>}
      {response.sources && <details className="assistant-sources"><summary>Evidence & sources ({response.sources.length})</summary>{response.sources.map((source, index) => <div key={`${source.source}-${index}`}><b>{source.source}</b><span>{source.filters}</span><small>{source.record_count} record(s) · {source.access}</small></div>)}</details>}
      {response.suggestions && <div className="assistant-suggestions">{response.suggestions.map((suggestion) => <button key={suggestion} onClick={() => void sendMessage(suggestion)}>{suggestion}</button>)}</div>}
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
      <div className="chatbot-input"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendMessage(); }} placeholder="Ask, query, explain or print…" disabled={loading} /><button type="button" onClick={() => void sendMessage()} disabled={loading}>Send</button></div>
    </div>}
  </>;
}
