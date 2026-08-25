import type { InvestigationResult } from "../types/investigation";

interface Props {
  result: InvestigationResult;
}

/* =========================================================
   HELPERS
========================================================= */

function StatusBadge({ status }: { status?: string }) {
  const value = status ?? "UNKNOWN";

  return <span className={`severity-badge severity-${value.toLowerCase()}`}>{value}</span>;
}

function FindingCard({ text }: { text: string }) {
  return (
    <div className="risk-driver-card">
      <div className="risk-driver-header">
        <span className="risk-driver-icon" aria-hidden="true">
          ⚠
        </span>

        <span className="risk-driver-title">Attention Required</span>
      </div>

      <p>{text}</p>
    </div>
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function InvestigationOverview({ result }: Props) {
  const report = result.final_report;

  const riskDrivers = report?.top_risk_drivers ?? [];

  const plan = result.investigation_plan;

  const sales = result.sales_rx_analysis;

  const doctor = result.doctor_territory_analysis;

  const payout = result.payout_analysis;

  return (
    <section className="investigation-overview">
      {/* ==================================================
          SINGLE OUTER CARD
      ================================================== */}

      <div className="investigation-overview-card">
        {/* ==================================================
            INVESTIGATION DECISION
        ================================================== */}

        <section className="investigation-decision-section">
          <div className="decision-header">
            <div>
              <h2>Investigation Decision</h2>

              <p className="decision-subtitle">Consolidated outcome of the audit investigation</p>
            </div>

            {report?.human_review_required ? (
              <div className="review-warning">Human Review Required</div>
            ) : (
              <div className="decision-approved">No Review Required</div>
            )}
          </div>

          {/* ================================================
              CURRENT ASSESSMENT
          ================================================= */}

          <div className="decision-status">
            <h4>Current Assessment</h4>

            <div className="decision-status-row">
              <StatusBadge status={result.overall_severity} />

              <p>
                Risk score: <strong>{result.overall_risk_score ?? 0}</strong>
                {" / 100"}
              </p>
            </div>
          </div>

          {/* ================================================
              ASSESSMENT
          ================================================= */}

          {report?.overall_assessment && (
            <div className="decision-assessment">
              <h4>Assessment</h4>

              <p>{report.overall_assessment}</p>
            </div>
          )}

          {/* ================================================
              KEY FINDINGS
          ================================================= */}

          <div className="decision-findings">
            <h4>Key Findings</h4>

            {riskDrivers.length > 0 ? (
              <div className="risk-driver-list">
                {riskDrivers.map((item, index) => (
                  <FindingCard key={`${index}-${item}`} text={item} />
                ))}
              </div>
            ) : (
              <p className="overview-empty-text">No significant risk drivers identified.</p>
            )}
          </div>
        </section>

        {/* ==================================================
            SECTION DIVIDER
        ================================================== */}

        <div className="investigation-section-divider" />

        {/* ==================================================
            EVIDENCE & AI REASONING
        ================================================== */}

        <section className="investigation-evidence-section">
          <div className="overview-detailed-heading">
            <div>
              <h3>Evidence &amp; AI Reasoning</h3>

              <p>Investigation methodology, evidence reviewed and specialist reasoning</p>
            </div>
          </div>

          <div className="overview-detailed-content">
            {/* ============================================
                INVESTIGATION SCOPE
            ============================================ */}

            <section className="workflow-summary-card">
              <div>
                <h3>Representative</h3>

                <p>{result.representative_id}</p>
              </div>

              <div>
                <h3>Investigation Period</h3>

                <p>
                  {result.start_date} to {result.end_date}
                </p>
              </div>

              <div>
                <h3>Products Reviewed</h3>

                <p>{result.products_analyzed?.length ?? 0}</p>
              </div>

              <div>
                <h3>Areas Reviewed</h3>

                <p>{plan?.focus_areas?.length ?? 0} specialist areas</p>
              </div>
            </section>

            {/* ============================================
                INVESTIGATION PLAN
            ============================================ */}

            <section className="workflow-card">
              <div className="workflow-card-heading">
                <h3>Investigation Areas Reviewed</h3>

                <span className="workflow-priority">
                  Priority: <strong>{plan?.priority ?? "N/A"}</strong>
                </span>
              </div>

              <div className="tag-container">
                {plan?.focus_areas?.map((area) => (
                  <span key={area} className="workflow-tag">
                    {area.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}
                  </span>
                ))}
              </div>
            </section>

            {/* ============================================
                SPECIALIST EVIDENCE
            ============================================ */}

            <section className="workflow-grid">
              {/* SALES / PRESCRIPTION */}

              <div className="workflow-card">
                <div className="workflow-card-heading">
                  <h3>Sales &amp; Prescription Evidence</h3>

                  <StatusBadge status={sales?.severity} />
                </div>

                <p className="workflow-summary">
                  {sales?.summary ?? "No sales and prescription evidence available."}
                </p>

                {sales?.key_observations && sales.key_observations.length > 0 && (
                  <>
                    <h4>Key Observations</h4>

                    <ul>
                      {sales.key_observations.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {/* DOCTOR / TERRITORY */}

              <div className="workflow-card">
                <div className="workflow-card-heading">
                  <h3>Doctor &amp; Territory Evidence</h3>

                  <StatusBadge status={doctor?.severity} />
                </div>

                <p className="workflow-summary">
                  {doctor?.summary ?? "No doctor and territory evidence available."}
                </p>

                {doctor?.key_observations && doctor.key_observations.length > 0 && (
                  <>
                    <h4>Key Observations</h4>

                    <ul>
                      {doctor.key_observations.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {/* PAYOUT */}

              <div className="workflow-card">
                <div className="workflow-card-heading">
                  <h3>Payout Evidence</h3>

                  <StatusBadge status={payout?.severity} />
                </div>

                <p className="workflow-summary">
                  {payout?.summary ?? "No payout evidence available."}
                </p>

                {payout?.key_observations && payout.key_observations.length > 0 && (
                  <>
                    <h4>Key Observations</h4>

                    <ul>
                      {payout.key_observations.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </section>
  );
}
