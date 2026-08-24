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
  findings?: Finding[];
};

type ProductOption = {
  id: string;
  name: string;
};

const CHART_COLORS = {
  historical: "#2563EB",
  current: "#7C3AED",
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

      <div className="analysis-chart-grid product-analysis-grid">
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

                  <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                    {salesData.map((item) => (
                      <Cell key={item.name} fill={item.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AnimateOnView>
          </div>
        </div>

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

                  <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                    {payoutData.map((item) => (
                      <Cell key={item.name} fill={item.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AnimateOnView>
          </div>
        </div>
      </div>
    </section>
  );
}
