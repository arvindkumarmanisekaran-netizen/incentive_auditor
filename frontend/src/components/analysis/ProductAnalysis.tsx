import { useEffect, useMemo, useState } from "react";

import type { EChartsCoreOption } from "echarts/core";

import type { Finding } from "../../types/investigation";

import SignalChart, { SIGNAL_CHART } from "../charts/SignalChart";

type Props = {
  findings?: Finding[];
};

type ProductOption = {
  id: string;
  name: string;
};

type BarChartType = "sales" | "sales_rx" | "payout" | "historical" | "peer";

const CHART_PALETTES: Record<BarChartType, string[]> = {
  sales: [SIGNAL_CHART.steel, SIGNAL_CHART.lime],
  sales_rx: [SIGNAL_CHART.lime, SIGNAL_CHART.mint],
  payout: [SIGNAL_CHART.mint, SIGNAL_CHART.amber],
  historical: [SIGNAL_CHART.steel, SIGNAL_CHART.lime],
  peer: [SIGNAL_CHART.lime, SIGNAL_CHART.amber],
};

function getDynamicBarColor(
  chartType: BarChartType,
  value: number,
  index: number,
) {
  const absoluteValue = Math.abs(Number(value) || 0);

  if (absoluteValue === 0) {
    return "rgba(148, 163, 184, 0.42)";
  }

  const palette = CHART_PALETTES[chartType];
  return palette[index % palette.length];
}

const CHART_COLORS = {
  historical: "#64d8b4",
  current: "#8fc95a",
  expected: "#16A34A",
  actual: "#DC2626",
};

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function getProductContext(finding?: Finding) {
  if (!finding) {
    return {
      id: "",
      name: "",
    };
  }

  const item = finding as Finding & {
    product_name?: string;
  };

  return {
    id: String(finding.product_id ?? ""),
    name: item.product_name ?? String(finding.evidence?.product_name ?? ""),
  };
}

function getProductFinding(findings: Finding[], type: string, productId: string) {
  return findings.find(
    (finding) => finding.type === type && String(finding.product_id ?? "") === productId,
  );
}

function createBarOption(
  data: Array<{ name: string; amount: number }>,
  chartType: BarChartType,
  formatter: "money" | "percent" = "money",
): EChartsCoreOption {
  return {
    tooltip: {
      valueFormatter: (value: unknown) =>
        formatter === "percent" ? `${Number(value).toFixed(2)}%` : formatMoney(Number(value)),
    },
    xAxis: { type: "category", data: data.map((item) => item.name) },
    yAxis: {
      type: "value",
      min: (range: { min: number }) => Math.min(0, range.min),
      max: (range: { max: number }) => Math.max(0, range.max),
      axisLine: {
        show: true,
        onZero: true,
        lineStyle: { color: "rgba(37,99,235,0.24)", width: 1 },
      },
      axisLabel: formatter === "percent" ? { formatter: "{value}%" } : undefined,
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 86,
        animationDuration: 900,
        animationEasing: "cubicOut",
        data: data.map((item, index) => ({
          value: item.amount,
          itemStyle: {
            color: getDynamicBarColor(chartType, item.amount, index),
            borderRadius: item.amount >= 0 ? [7, 7, 2, 2] : [2, 2, 7, 7],
            shadowBlur: 18,
            shadowColor: "rgba(37,99,235,.10)",
          },
        })),
      },
    ],
  };
}

export default function ProductAnalysis({ findings = [] }: Props) {
  const [selectedProductId, setSelectedProductId] = useState("");

  const productOptions = useMemo<ProductOption[]>(() => {
    const products = new Map<string, ProductOption>();

    findings.forEach((finding) => {
      const context = getProductContext(finding);

      if (!context.id || context.id === "ALL") {
        return;
      }

      if (!products.has(context.id)) {
        products.set(context.id, {
          id: context.id,
          name: context.name,
        });
      }
    });

    return Array.from(products.values());
  }, [findings]);

  useEffect(() => {
    if (!productOptions.length) {
      setSelectedProductId("");
      return;
    }

    if (!productOptions.some((p) => p.id === selectedProductId)) {
      setSelectedProductId(productOptions[0].id);
    }
  }, [productOptions, selectedProductId]);

  const salesFinding = getProductFinding(findings, "sales_deviation", selectedProductId);

  const mismatchFinding = getProductFinding(
    findings,
    "sales_prescription_mismatch",
    selectedProductId,
  );

  const payoutFinding = getProductFinding(findings, "payout_discrepancy", selectedProductId);

  const salesData = salesFinding
    ? [
        {
          name: "Historical Avg",
          amount: Number(salesFinding.evidence.historical_average),
          fill: CHART_COLORS.historical,
        },
        {
          name: "Current Sales",
          amount: Number(salesFinding.evidence.current_sales),
          fill: CHART_COLORS.current,
        },
      ]
    : [];

  const mismatchData = mismatchFinding
    ? [
        {
          name: "Sales Change",
          amount: Number(mismatchFinding.evidence.sales_change_percent),
        },
        {
          name: "Prescription Change",
          amount: Number(mismatchFinding.evidence.prescription_change_percent),
        },
      ]
    : [];

  const payoutData = payoutFinding
    ? [
        {
          name: "Expected",
          amount: Number(payoutFinding.evidence.expected_payout),
          fill: CHART_COLORS.expected,
        },
        {
          name: "Actual",
          amount: Number(payoutFinding.evidence.actual_payout),
          fill: CHART_COLORS.actual,
        },
      ]
    : [];

  const selectedProduct = productOptions.find((p) => p.id === selectedProductId);

  return (
    <section className="analysis-panel product-analysis-section">
      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="analysis-panel-header analysis-section-header">
        <div>
          <h3>Product Analysis</h3>

          <p>Sales, prescription and payout behaviour for selected product</p>
        </div>

        <div className="analysis-product-selector product-analysis-selector">
          <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
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
        </div>
      )}

      {/* ==================================================
          SALES / PRESCRIPTION MISMATCH SUMMARY
      ================================================== */}

      {mismatchFinding && (
        <div className="product-mismatch-summary">
          <div className="product-mismatch-header">
            <div>
              <h4>Sales &amp; Prescription Alignment</h4>

              <p>Comparison of sales movement against prescription movement</p>
            </div>

            <span
              className={`severity-badge severity-${String(
                mismatchFinding.severity ?? "NORMAL",
              ).toLowerCase()}`}
            >
              {mismatchFinding.severity ?? "NORMAL"}
            </span>
          </div>

          <div className="product-mismatch-metrics">
            <div className="product-mismatch-metric">
              <span>Sales Change</span>

              <strong>
                {Number(mismatchFinding.evidence.sales_change_percent ?? 0).toFixed(2)}%
              </strong>
            </div>

            <div className="product-mismatch-metric">
              <span>Prescription Change</span>

              <strong>
                {Number(mismatchFinding.evidence.prescription_change_percent ?? 0).toFixed(2)}%
              </strong>
            </div>

            <div className="product-mismatch-metric">
              <span>Mismatch Score</span>

              <strong>{Number(mismatchFinding.evidence.mismatch_score ?? 0).toFixed(2)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          CHARTS
      ================================================== */}

      <div className="analysis-chart-grid product-analysis-grid">
        {/* =============================
            SALES PERFORMANCE
        ============================= */}

        <div className="chart-card">
          <div className="chart-heading">
            <h3>Sales Performance</h3>

            <p>Current sales vs historical baseline</p>
          </div>

          <div className="chart-container">
            <SignalChart option={createBarOption(salesData, "sales")} ariaLabel="Sales performance" />
          </div>
        </div>

        {/* =============================
            SALES / PRESCRIPTION
        ============================= */}

        <div className="chart-card">
          <div className="chart-heading">
            <h3>Sales / Prescription Alignment</h3>

            <p>Percentage movement during the investigation period</p>
          </div>

          <div className="chart-container">
            <SignalChart
              option={createBarOption(mismatchData, "sales_rx", "percent")}
              ariaLabel="Sales and prescription alignment"
            />
          </div>
        </div>

        {/* =============================
            PAYOUT COMPARISON
        ============================= */}

        <div className="chart-card">
          <div className="chart-heading">
            <h3>Payout Comparison</h3>

            <p>Expected incentive vs actual payout</p>
          </div>

          <div className="chart-container">
            <SignalChart option={createBarOption(payoutData, "payout")} ariaLabel="Payout comparison" />
          </div>
        </div>
      </div>
    </section>
  );
}
