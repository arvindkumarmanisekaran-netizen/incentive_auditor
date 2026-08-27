import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import type { EChartsCoreOption } from "echarts/core";
import SignalChart, { SIGNAL_CHART } from "../charts/SignalChart";

import type { PeerAnalysis as PeerAnalysisType } from "../../types/investigation";

type Props = {
  peerAnalysis?: PeerAnalysisType;
  representativeId?: string;
};

const CHART_THEME = {
  representative: SIGNAL_CHART.lime,
  peer: SIGNAL_CHART.amber,
  distribution: SIGNAL_CHART.mint,
};

function normalize(value: number, average: number) {
  if (!average) return 0;

  return Math.min(Math.round((value / average) * 100), 200);
}

function formatMoney(value?: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatNumber(value?: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatPercent(value?: number) {
  const numeric = Number(value ?? 0);

  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(2)}%`;
}

function peerSalesOption(data: Array<{ product: string; representative: number; peer: number }>): EChartsCoreOption {
  return {
    legend: { top: 0, textStyle: { color: SIGNAL_CHART.text, fontSize: 9 } },
    grid: { top: 55, right: 12, bottom: 8, left: 12 },
    xAxis: { type: "category", data: data.map((item) => item.product), axisLabel: { rotate: 24 } },
    yAxis: { type: "value" },
    series: [
      { type: "bar", name: "Representative", data: data.map((item) => item.representative), itemStyle: { color: CHART_THEME.representative, borderRadius: [6, 6, 1, 1] } },
      { type: "bar", name: "Peer average", data: data.map((item) => item.peer), itemStyle: { color: CHART_THEME.peer, borderRadius: [6, 6, 1, 1] } },
    ],
  };
}

function peerIndexOption(data: Array<{ metric: string; representative: number }>): EChartsCoreOption {
  return {
    grid: { top: 18, right: 12, bottom: 12, left: 12 },
    xAxis: { type: "value", min: 0, max: 200 },
    yAxis: { type: "category", data: data.map((item) => item.metric) },
    series: [{
      type: "bar",
      name: "Representative index",
      barWidth: 8,
      data: data.map((item) => item.representative),
      itemStyle: { color: CHART_THEME.representative, borderRadius: 8 },
      markLine: {
        animation: false,
        symbol: "none",
        label: { formatter: "Peer 100", color: SIGNAL_CHART.amber, fontSize: 9 },
        lineStyle: { color: SIGNAL_CHART.amber, type: "dashed" },
        data: [{ xAxis: 100 }],
      },
    }],
  };
}

function peerScatterOption(
  peers: Array<{ sales: number; payout: number; displayName: string }>,
  representative: Array<{ sales: number; payout: number; displayName: string }>,
  average: Array<{ sales: number; payout: number; displayName: string }>,
): EChartsCoreOption {
  const map = (items: Array<{ sales: number; payout: number; displayName: string }>) =>
    items.map((item) => ({ name: item.displayName, value: [item.sales, item.payout] }));
  return {
    legend: { top: 0, textStyle: { color: SIGNAL_CHART.text, fontSize: 9 } },
    grid: { top: 46, right: 20, bottom: 44, left: 62 },
    xAxis: { type: "value", name: "Sales", nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "value", name: "Payout", nameLocation: "middle", nameGap: 44 },
    tooltip: {
      trigger: "item",
      formatter: (params: { name?: string; value?: number[] }) =>
        `<strong>${params.name ?? ""}</strong><br/>Sales ${formatMoney(params.value?.[0])}<br/>Payout ${formatMoney(params.value?.[1])}`,
    },
    series: [
      { type: "scatter", name: "Peers", data: map(peers), symbolSize: 9, itemStyle: { color: CHART_THEME.distribution } },
      { type: "scatter", name: "Representative", data: map(representative), symbol: "diamond", symbolSize: 17, itemStyle: { color: CHART_THEME.representative } },
      { type: "scatter", name: "Peer average", data: map(average), symbol: "triangle", symbolSize: 16, itemStyle: { color: CHART_THEME.peer } },
    ],
  };
}
export default function PeerAnalysis({ representativeId, peerAnalysis }: Props) {
  const comparison = peerAnalysis?.product_peer_comparison;

  const productEntries = useMemo(
    () => (comparison?.products ? Object.entries(comparison.products) : []),
    [comparison],
  );

  const [selectedProductId, setSelectedProductId] = useState(productEntries[0]?.[0] ?? "");

  if (!comparison?.products || productEntries.length === 0) {
    return (
      <section className="peer-analysis-section">
        <div className="analysis-panel-header analysis-section-header">
          <div>
            <h3>Peer Benchmark</h3>

            <p>Compare representative performance against the available peer population.</p>
          </div>
        </div>

        <div className="chart-card">No peer comparison data available.</div>
      </section>
    );
  }

  const selectedEntry =
    productEntries.find(([id]) => id === selectedProductId) ?? productEntries[0];

  const [selectedId, selected] = selectedEntry;

  const comparisonData = productEntries.map(([id, item]) => ({
    product: `${item.product_name} (${id})`,
    representative: item.representative.sales,
    peer: item.peer_average.sales,
  }));

  const dumbbellData = [
    {
      metric: "Sales",
      representative: normalize(selected.representative.sales, selected.peer_average.sales),
      peer: 100,
    },
    {
      metric: "Prescription",
      representative: normalize(selected.representative.rx, selected.peer_average.rx),
      peer: 100,
    },
    {
      metric: "Payout",
      representative: normalize(selected.representative.payout, selected.peer_average.payout),
      peer: 100,
    },
  ];

  const peerDistribution = selected.peer_distribution.map((peer) => ({
    id: peer.representative_id,
    name: peer.representative_name,
    displayName: `${peer.representative_name} (${peer.representative_id})`,
    sales: peer.sales,
    payout: peer.payout,
    rx: peer.rx,
    type: "Peer",
  }));

  const representativePoint = [
    {
      id: representativeId ?? "Current Representative",
      name: selected.representative_name,
      displayName: `${selected.representative_name} (${representativeId ?? ""})`,
      sales: selected.representative.sales,
      payout: selected.representative.payout,
      rx: selected.representative.rx,
      type: "Current Representative",
    },
  ];

  const peerAveragePoint = [
    {
      id: "Peer Average",
      name: "Peer Average",
      displayName: "Peer Average",
      sales: selected.peer_average.sales,
      payout: selected.peer_average.payout,
      rx: selected.peer_average.rx,
      type: "Peer Average",
    },
  ];

  const salesDifference = selected.difference_percentage?.sales ?? 0;

  const rxDifference = selected.difference_percentage?.rx ?? 0;

  const payoutDifference = selected.difference_percentage?.payout ?? 0;

  return (
    <section className="peer-analysis-section">
      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="analysis-panel-header analysis-section-header">
        <div>
          <h3>Peer Benchmark</h3>

          <p>Compare the selected representative against peers for each product.</p>
        </div>

        <div className="analysis-product-selector">
          <select value={selectedId} onChange={(event) => setSelectedProductId(event.target.value)}>
            {productEntries.map(([id, item]) => (
              <option key={id} value={id}>
                {id} • {item.product_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ==================================================
          PRODUCT CONTEXT
      ================================================== */}

      <div className="product-analysis-context">
        <span className="product-analysis-id">{selectedId}</span>

        <span className="product-analysis-divider">•</span>

        <span className="product-analysis-name">{selected.product_name}</span>

        <span className="peer-count">{selected.peer_group_size} peers</span>
      </div>

      {/* ==================================================
          BENCHMARK KPI SUMMARY
      ================================================== */}

      <div className="peer-summary-grid">
        <div className="peer-summary-card">
          <span>Representative Sales</span>

          <strong>{formatMoney(selected.representative.sales)}</strong>

          <small>{formatPercent(salesDifference)} vs peer</small>
        </div>

        <div className="peer-summary-card">
          <span>Peer Average Sales</span>

          <strong>{formatMoney(selected.peer_average.sales)}</strong>

          <small>{selected.peer_group_size} comparable reps</small>
        </div>

        <div className="peer-summary-card">
          <span>Representative Rx</span>

          <strong>{formatNumber(selected.representative.rx)}</strong>

          <small>{formatPercent(rxDifference)} vs peer</small>
        </div>

        <div className="peer-summary-card">
          <span>Representative Payout</span>

          <strong>{formatMoney(selected.representative.payout)}</strong>

          <small>{formatPercent(payoutDifference)} vs peer</small>
        </div>
      </div>

      <div className="peer-analysis-grid">
        {/* ==================================================
            SALES COMPARISON
        ================================================== */}

        <div className="chart-card">
          <div className="chart-heading">
            <h3>Sales vs Peer Average</h3>

            <p>Representative sales compared across all analyzed products.</p>
          </div>

          <SignalChart option={peerSalesOption(comparisonData)} height={360} ariaLabel="Sales versus peer average" />
        </div>

        {/* ==================================================
            RELATIVE POSITION
        ================================================== */}

        <div className="chart-card">
          <div className="chart-heading">
            <h3>Representative vs Peer Index</h3>

            <p>Peer average = 100. Values above 100 are above peer average.</p>
          </div>

          <div className="chart-container peer-dumbbell-chart">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`peer-index-${selectedId}`}
                className="peer-index-chart-transition"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: .2, ease: "easeOut" }}
              >
                <SignalChart option={peerIndexOption(dumbbellData)} ariaLabel="Representative peer index" />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ==================================================
            PEER DISTRIBUTION
        ================================================== */}

        <div className="chart-card">
          <div className="chart-heading">
            <h3>Peer Distribution</h3>

            <p>
              Sales and payout position among comparable representatives for {selected.product_name}
              .
            </p>
          </div>

          <SignalChart
            option={peerScatterOption(peerDistribution, representativePoint, peerAveragePoint)}
            height={360}
            ariaLabel="Peer sales and payout distribution"
          />
        </div>

        {/* ==================================================
            PEER INDICATORS
        ================================================== */}

        <div className="chart-card peer-indicator-card">
          <div className="chart-heading">
            <h3>Peer Indicators</h3>

            <p>Contextual benchmark status across analyzed products.</p>
          </div>

          <div className="product-status-grid">
            {productEntries.map(([id, item]) => (
              <div
                key={id}
                data-tooltip={`${item.product_name} (${id})`}
                className={
                  id === selectedId
                    ? "product-status-card normal-card active"
                    : item.anomaly_detected
                      ? "product-status-card review-card"
                      : "product-status-card normal-card"
                }
                onClick={() => setSelectedProductId(id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    setSelectedProductId(id);
                  }
                }}
              >
                <div className="product-title">
                  {item.product_name} ({id})
                </div>

                <div className="status-wrapper">
                  <span className="peer-count">{item.peer_group_size} peers</span>

                  <span
                    className={
                      item.anomaly_detected ? "status-badge review" : "status-badge normal"
                    }
                  >
                    {item.anomaly_detected ? "Review" : "Normal"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
