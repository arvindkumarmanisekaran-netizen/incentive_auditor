import { useMemo, useState } from "react";

import "../styles/index.css";
import type { Finding } from "../types/investigation";

type Props = {
  findings: Finding[];
};

function formatMoney(value: unknown) {
  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: unknown) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return "—";
  }

  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function getTitle(type: string) {
  switch (type) {
    case "sales_deviation":
      return "Sales";

    case "sales_prescription_mismatch":
      return "Sales / Rx";

    case "doctor_concentration":
      return "Doctor Concentration";

    case "cross_territory_concentration":
      return "Territory";

    case "payout_discrepancy":
      return "Payout";

    default:
      return "Finding";
  }
}

function getProductName(finding: Finding) {
  return (
    (finding as Finding & { product_name?: string }).product_name ??
    finding.evidence?.product_name ??
    ""
  );
}

function severityRank(severity?: string) {
  switch (severity?.toUpperCase()) {
    case "HIGH":
      return 4;

    case "MEDIUM":
      return 3;

    case "LOW":
      return 2;

    case "NORMAL":
      return 1;

    default:
      return 0;
  }
}

function getGroupSeverity(findings: Finding[]) {
  return findings.reduce(
    (highest, finding) =>
      severityRank(finding.severity) > severityRank(highest) ? finding.severity : highest,
    "NORMAL",
  );
}

function FindingContent({ finding }: { finding: Finding }) {
  const e = finding.evidence;

  switch (finding.type) {
    case "sales_deviation":
      return (
        <div className="compact-finding-metrics">
          <div>
            <span>Current</span>
            <strong>{formatMoney(e.current_sales)}</strong>
          </div>

          <div>
            <span>Historical</span>
            <strong>{formatMoney(e.historical_average)}</strong>
          </div>

          <div>
            <span>Change</span>
            <strong>{formatPercent(e.deviation_percent)}</strong>
          </div>
        </div>
      );

    case "sales_prescription_mismatch":
      return (
        <div className="compact-finding-metrics">
          <div>
            <span>Sales</span>
            <strong>{formatPercent(e.sales_change_percent)}</strong>
          </div>

          <div>
            <span>Rx</span>
            <strong>{formatPercent(e.prescription_change_percent)}</strong>
          </div>

          <div>
            <span>Mismatch</span>
            <strong>{Number(e.mismatch_score).toFixed(2)}</strong>
          </div>
        </div>
      );

    case "payout_discrepancy":
      return (
        <div className="compact-finding-metrics">
          <div>
            <span>Expected</span>
            <strong>{formatMoney(e.expected_payout)}</strong>
          </div>

          <div>
            <span>Actual</span>
            <strong>{formatMoney(e.actual_payout)}</strong>
          </div>

          <div>
            <span>Difference</span>
            <strong>{formatMoney(e.payout_difference)}</strong>
          </div>
        </div>
      );

    case "doctor_concentration":
      return (
        <div className="compact-finding-metrics">
          <div>
            <span>Top Doctor</span>
            <strong>{formatPercent(e.top_doctor_share_percent)}</strong>
          </div>

          <div>
            <span>Top 3</span>
            <strong>{formatPercent(e.top_3_share_percent)}</strong>
          </div>

          <div>
            <span>Total Sales</span>
            <strong>{formatMoney(e.total_sales)}</strong>
          </div>
        </div>
      );

    case "cross_territory_concentration":
      return (
        <div className="compact-finding-metrics">
          <div>
            <span>Home</span>
            <strong>{formatMoney(e.home_territory_sales)}</strong>
          </div>

          <div>
            <span>Cross</span>
            <strong>{formatMoney(e.cross_territory_sales)}</strong>
          </div>

          <div>
            <span>Share</span>
            <strong>{formatPercent(e.cross_territory_share_percent)}</strong>
          </div>
        </div>
      );

    default:
      return <p className="muted-text">No detailed evidence.</p>;
  }
}

function FindingsList({ findings }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const groupedFindings = useMemo(() => {
    return findings.reduce<Record<string, Finding[]>>((groups, finding) => {
      const key = finding.product_id && finding.product_id !== "ALL" ? finding.product_id : "ALL";

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(finding);

      return groups;
    }, {});
  }, [findings]);

  if (!findings.length) {
    return (
      <section className="findings-section">
        <h2>Risk Signals</h2>

        <div className="empty-card">No anomaly signals detected.</div>
      </section>
    );
  }

  return (
    <section className="findings-section">
      <div className="section-heading">
        <div>
          <h2>Risk Signals</h2>
          <p>Deterministic indicators detected during the investigation</p>
        </div>
      </div>

      <div className="finding-accordion">
        {Object.entries(groupedFindings).map(([productId, productFindings]) => {
          const isExpanded = expanded[productId] ?? false;

          const firstFinding = productFindings[0];

          const productName =
            productId === "ALL" ? "Overall Signals" : getProductName(firstFinding);

          const severity = getGroupSeverity(productFindings);

          return (
            <article className={`finding-group ${isExpanded ? "expanded" : ""}`} key={productId}>
              <button
                type="button"
                className="finding-group-toggle"
                onClick={() =>
                  setExpanded((current) => ({
                    ...current,
                    [productId]: !isExpanded,
                  }))
                }
                aria-expanded={isExpanded}
              >
                <div className="finding-group-product">
                  <div className="finding-group-title-row">
                    <strong>{productId === "ALL" ? "Overall" : productId}</strong>

                    {productName && (
                      <span className="finding-group-product-name">{productName}</span>
                    )}
                  </div>

                  <span className="finding-group-count">
                    {productFindings.length} signal
                    {productFindings.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="finding-group-actions">
                  <span className={`severity-badge severity-${severity.toLowerCase()}`}>
                    {severity}
                  </span>

                  <span
                    className={`finding-chevron ${isExpanded ? "open" : ""}`}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="finding-group-content">
                  {productFindings.map((finding, index) => (
                    <div
                      className="compact-finding-row"
                      key={`${finding.type}-${finding.product_id}-${index}`}
                    >
                      <div className="compact-finding-header">
                        <span className="compact-finding-title">{getTitle(finding.type)}</span>

                        <span
                          className={`severity-badge severity-${finding.severity.toLowerCase()}`}
                        >
                          {finding.severity}
                        </span>
                      </div>

                      <FindingContent finding={finding} />
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default FindingsList;
