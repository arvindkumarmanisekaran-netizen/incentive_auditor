import { useEffect, useMemo, useState } from "react";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { Finding } from "../../types/investigation";

import { AnimateOnView } from "../AnimateOnView";

type Props = {
  findings?: Finding[];
};

type ProductOption = {
  id: string;
  name: string;
};

type BarChartType = "sales" | "sales_rx" | "payout" | "historical" | "peer";

const CHART_HUES: Record<BarChartType, number[]> = {
  sales: [270, 285, 300],
  sales_rx: [270, 215],
  payout: [160, 335],
  historical: [215, 270],
  peer: [215, 32],
};

function getDynamicBarColor(
  chartType: BarChartType,
  value: number,
  index: number,
  values: number[],
) {
  const absoluteValue = Math.abs(Number(value) || 0);

  const maxValue = Math.max(...values.map((item) => Math.abs(Number(item) || 0)), 1);

  if (absoluteValue === 0) {
    return "rgba(148, 163, 184, 0.42)";
  }

  const intensity = absoluteValue / maxValue;

  const hues = CHART_HUES[chartType];

  const hue = hues[index % hues.length];

  const saturation = 62 + intensity * 22;

  const lightness = 68 - intensity * 22;

  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function signedDomain(values: number[]): [number, number] {
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const span = Math.max(maximum - minimum, 1);
  const padding = span * 0.1;

  return [minimum < 0 ? minimum - padding : 0, maximum > 0 ? maximum + padding : 0];
}

const CHART_COLORS = {
  historical: "#2563EB",
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

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="chart-custom-tooltip visible">
      <span>{item.name}</span>
      <strong>{formatMoney(item.amount)}</strong>
    </div>
  );
}

function PercentageTooltip({ active, payload }: any) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="chart-custom-tooltip visible">
      <span>{item.name}</span>

      <strong>{Number(item.amount).toFixed(2)}%</strong>
    </div>
  );
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
  const salesValues = salesData.map((item) => Number(item.amount));
  const mismatchValues = mismatchData.map((item) => Number(item.amount));
  const payoutValues = payoutData.map((item) => Number(item.amount));

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
            <AnimateOnView>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />

                  <XAxis dataKey="name" tickLine={false} axisLine={false} />

                  <YAxis tickLine={false} axisLine={false} />

                  <Tooltip content={<ChartTooltip />} />

                  <Bar
                    dataKey="amount"
                    shape={(props: any) => {
                      const index = Number(props.index ?? 0);

                      const fill = getDynamicBarColor(
                        "sales",
                        Number(props.payload?.amount ?? 0),
                        index,
                        salesValues,
                      );

                      return (
                        <rect
                          x={Number(props.x ?? 0)}
                          y={Number(props.y ?? 0)}
                          width={Number(props.width ?? 0)}
                          height={Number(props.height ?? 0)}
                          rx={7}
                          ry={7}
                          fill={fill}
                        />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </AnimateOnView>
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
            <AnimateOnView>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mismatchData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />

                  <XAxis dataKey="name" tickLine={false} axisLine={false} />

                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    domain={signedDomain(mismatchValues)}
                    allowDecimals={false}
                    width={48}
                    tickFormatter={(value) => `${Math.round(Number(value))}%`}
                  />

                  <Tooltip content={<PercentageTooltip />} />

                  <Bar
                    dataKey="amount"
                    shape={(props: any) => {
                      const index = Number(props.index ?? 0);
                      const value = Number(props.payload?.amount ?? 0);

                      const rawY = Number(props.y ?? 0);
                      const rawHeight = Number(props.height ?? 0);

                      // SVG rect cannot render a negative height.
                      const y = rawHeight < 0 ? rawY + rawHeight : rawY;
                      const height = Math.abs(rawHeight);

                      const fill = getDynamicBarColor("sales_rx", value, index, mismatchValues);

                      return (
                        <rect
                          x={Number(props.x ?? 0)}
                          y={y}
                          width={Number(props.width ?? 0)}
                          height={height}
                          rx={7}
                          ry={7}
                          fill={fill}
                        />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </AnimateOnView>
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
            <AnimateOnView>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={payoutData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />

                  <XAxis dataKey="name" tickLine={false} axisLine={false} />

                  <YAxis tickLine={false} axisLine={false} />

                  <Tooltip content={<ChartTooltip />} />

                  <Bar
                    dataKey="amount"
                    shape={(props: any) => {
                      const index = Number(props.index ?? 0);

                      const fill = getDynamicBarColor(
                        "payout",
                        Number(props.payload?.amount ?? 0),
                        index,
                        payoutValues,
                      );

                      return (
                        <rect
                          x={Number(props.x ?? 0)}
                          y={Number(props.y ?? 0)}
                          width={Number(props.width ?? 0)}
                          height={Number(props.height ?? 0)}
                          rx={7}
                          ry={7}
                          fill={fill}
                        />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </AnimateOnView>
          </div>
        </div>
      </div>
    </section>
  );
}
