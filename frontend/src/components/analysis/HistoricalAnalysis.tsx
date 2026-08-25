import { useEffect, useMemo, useState } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Finding } from "../../types/investigation";

import { AnimateOnView } from "../AnimateOnView";

type Props = {
  findings: Finding[];
};

type ProductOption = {
  id: string;
  name: string;
};

const CHART_COLORS = {
  historical: "#2563EB",
  current: "#7C3AED",
};

function formatMoney(value?: number) {
  if (value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getProductName(finding?: Finding) {
  if (!finding) {
    return "";
  }

  const item = finding as Finding & {
    product_name?: string;
  };

  return item.product_name ?? String(finding.evidence?.product_name ?? "");
}

function HistoricalTooltip({ active, payload }: any) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="chart-custom-tooltip visible">
      <span>{item.name}</span>

      <strong>{formatMoney(Number(item.amount))}</strong>
    </div>
  );
}

export default function HistoricalAnalysis({ findings }: Props) {
  const [selectedProductId, setSelectedProductId] = useState("");

  /* ==================================================
      PRODUCT OPTIONS
  ================================================== */

  const salesFindings = useMemo(
    () =>
      findings.filter(
        (finding) =>
          finding.type === "sales_deviation" && finding.product_id && finding.product_id !== "ALL",
      ),
    [findings],
  );

  const productOptions = useMemo<ProductOption[]>(
    () =>
      salesFindings.map((finding) => ({
        id: String(finding.product_id),
        name: getProductName(finding),
      })),
    [salesFindings],
  );

  useEffect(() => {
    if (!productOptions.length) {
      setSelectedProductId("");
      return;
    }

    if (!productOptions.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(productOptions[0].id);
    }
  }, [productOptions, selectedProductId]);

  /* ==================================================
      SELECTED PRODUCT
  ================================================== */

  const salesFinding = salesFindings.find(
    (finding) => String(finding.product_id) === selectedProductId,
  );

  const selectedProduct = productOptions.find((product) => product.id === selectedProductId);

  const historicalAverage = Number(salesFinding?.evidence?.historical_average ?? 0);

  const currentSales = Number(salesFinding?.evidence?.current_sales ?? 0);

  const deviation = Number(
    salesFinding?.evidence?.deviation_percent ?? salesFinding?.evidence?.sales_change_percent ?? 0,
  );

  const severity = salesFinding?.severity ?? "NORMAL";

  const difference = currentSales - historicalAverage;

  const direction =
    deviation > 0
      ? "Above historical average"
      : deviation < 0
        ? "Below historical average"
        : "Aligned with historical average";

  const comparisonData = [
    {
      name: "Historical Average",
      amount: historicalAverage,
      fill: CHART_COLORS.historical,
    },
    {
      name: "Investigation Period",
      amount: currentSales,
      fill: CHART_COLORS.current,
    },
  ];

  /* ==================================================
      RENDER
  ================================================== */

  return (
    <section className="historical-analysis-section">
      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="analysis-panel-header analysis-section-header">
        <div>
          <h3>Historical Baseline Comparison</h3>

          <p>Compare investigation-period sales against historical performance for each product.</p>
        </div>

        <div className="analysis-product-selector">
          <select
            value={selectedProductId}
            onChange={(event) => setSelectedProductId(event.target.value)}
          >
            {productOptions.map((product) => (
              <option key={product.id} value={product.id}>
                {product.id}
                {product.name && ` • ${product.name}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ==================================================
          PRODUCT CONTEXT
      ================================================== */}

      {selectedProduct && (
        <div className="product-analysis-context">
          <span className="product-analysis-id">{selectedProduct.id}</span>

          {selectedProduct.name && (
            <>
              <span className="product-analysis-divider">•</span>

              <span className="product-analysis-name">{selectedProduct.name}</span>
            </>
          )}

          <span className={`severity-badge severity-${String(severity).toLowerCase()}`}>
            {severity}
          </span>
        </div>
      )}

      {/* ==================================================
          KPI SUMMARY
      ================================================== */}

      <div className="historical-summary-grid">
        <div className="historical-summary-card">
          <span>Historical Average</span>

          <strong>{formatMoney(historicalAverage)}</strong>
        </div>

        <div className="historical-summary-card">
          <span>Investigation Period</span>

          <strong>{formatMoney(currentSales)}</strong>
        </div>

        <div className="historical-summary-card">
          <span>Difference</span>

          <strong>
            {difference > 0 ? "+" : ""}
            {formatMoney(difference)}
          </strong>
        </div>

        <div className="historical-summary-card">
          <span>Deviation</span>

          <strong>
            {deviation > 0 ? "+" : ""}
            {deviation.toFixed(2)}%
          </strong>

          <small>{direction}</small>
        </div>
      </div>

      {/* ==================================================
          HISTORICAL COMPARISON
      ================================================== */}

      <div className="historical-analysis-grid">
        <div className="chart-card historical-comparison-chart">
          <div className="chart-heading">
            <h3>Current vs Historical Baseline</h3>

            <p>Sales in the investigation period compared with the historical average.</p>
          </div>

          <div className="chart-container">
            <AnimateOnView>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />

                  <XAxis dataKey="name" tickLine={false} axisLine={false} />

                  <YAxis tickLine={false} axisLine={false} />

                  <Tooltip content={<HistoricalTooltip />} />

                  <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                    {comparisonData.map((item) => (
                      <Cell key={item.name} fill={item.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AnimateOnView>
          </div>
        </div>

        {/* ==================================================
            POSITION
        ================================================== */}

        <div className="chart-card historical-position-card">
          <div className="chart-heading">
            <h3>Historical Position</h3>

            <p>Relative movement from the historical sales baseline.</p>
          </div>

          <div className="historical-position">
            <strong>{direction}</strong>

            <span>
              {deviation > 0 ? "+" : ""}
              {deviation.toFixed(2)}%
            </span>
          </div>

          <div className="position-indicator historical-diverging-bar">
            <div className="historical-position-center" />

            {deviation !== 0 && (
              <div
                key={selectedProductId}
                className={`position-fill ${
                  deviation < 0 ? "position-negative" : "position-positive"
                }`}
                style={{
                  width: `${Math.min(Math.abs(deviation) * 1.5, 50)}%`,
                }}
              />
            )}
          </div>

          <span className="position-label">
            {severity === "NORMAL"
              ? "Movement remains within the normal analytical range."
              : `${severity} deviation identified for review.`}
          </span>
        </div>
      </div>
    </section>
  );
}
