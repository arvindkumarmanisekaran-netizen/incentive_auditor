import { useMemo, useState } from "react";

import {
  Label,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ScatterChart,
  Scatter,
  Legend,
} from "recharts";

import type { PeerAnalysis as PeerAnalysisType } from "../../types/investigation";

type Props = {
  peerAnalysis?: PeerAnalysisType;
  representativeId?: string;
};

const CHART_THEME = {
  representative: "#2563eb",
  peer: "#f59e0b",
  distribution: "#10b981",
  grid: "#e5e7eb",
  text: "#475569",
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
type DumbbellShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { peer?: number; representative?: number };
};

function DumbbellShape({ x = 0, y = 0, width = 0, height = 0, payload }: DumbbellShapeProps) {
  if (!payload) {
    return null;
  }

  const peer = Number(payload.peer ?? 100);
  const representative = Number(payload.representative ?? 0);

  const min = 0;
  const max = 200;

  const scale = (value: number) => x + ((value - min) / (max - min)) * width;

  const peerX = scale(peer);
  const representativeX = scale(representative);

  const centerY = y + height / 2;

  return (
    <g>
      <line
        x1={peerX}
        x2={representativeX}
        y1={centerY}
        y2={centerY}
        stroke="rgba(185, 255, 102, 0.35)"
        strokeWidth={4}
        strokeLinecap="round"
      />

      <circle cx={peerX} cy={centerY} r={7} fill="#F59E0B" />

      <circle cx={representativeX} cy={centerY} r={8} fill="#8fc95a" />
    </g>
  );
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

          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={comparisonData}>
              <CartesianGrid stroke={CHART_THEME.grid} />

              <XAxis
                dataKey="product"
                interval={0}
                angle={-35}
                textAnchor="end"
                height={90}
                tick={{
                  fill: CHART_THEME.text,
                  fontSize: 11,
                }}
              >
                <Label
                  value="Products"
                  position="insideBottom"
                  offset={-5}
                  style={{
                    fill: CHART_THEME.text,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                />
              </XAxis>

              <YAxis
                tick={{
                  fill: CHART_THEME.text,
                }}
              >
                <Label
                  value="Sales Value"
                  angle={-90}
                  position="insideLeft"
                  style={{
                    fill: CHART_THEME.text,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                />
              </YAxis>

              <Tooltip />

              <Bar
                dataKey="representative"
                name="Representative Sales"
                fill={CHART_THEME.representative}
                radius={[6, 6, 0, 0]}
              />

              <Bar
                dataKey="peer"
                name="Peer Average Sales"
                fill={CHART_THEME.peer}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dumbbellData}
                layout="vertical"
                margin={{
                  top: 12,
                  right: 28,
                  left: 20,
                  bottom: 8,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />

                <XAxis
                  type="number"
                  domain={[0, 200]}
                  tickLine={false}
                  axisLine={false}
                  ticks={[0, 50, 100, 150, 200]}
                />

                <YAxis
                  type="category"
                  dataKey="metric"
                  tickLine={false}
                  axisLine={false}
                  width={95}
                />

                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) {
                      return null;
                    }

                    const item = payload[0]?.payload;

                    if (!item) {
                      return null;
                    }

                    return (
                      <div className="chart-custom-tooltip visible">
                        <strong>{item.metric}</strong>

                        <div>
                          Representative: <strong>{Number(item.representative).toFixed(0)}</strong>
                        </div>

                        <div>
                          Peer Average: <strong>100</strong>
                        </div>

                        <div>
                          Difference:{" "}
                          <strong>
                            {Number(item.representative - 100) > 0 ? "+" : ""}
                            {Number(item.representative - 100).toFixed(0)}%
                          </strong>
                        </div>
                      </div>
                    );
                  }}
                />

                <Bar dataKey="representative" shape={<DumbbellShape />} isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
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

          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart
              key={selectedId}
              margin={{
                top: 20,
                right: 25,
                bottom: 35,
                left: 5,
              }}
            >
              <CartesianGrid stroke={CHART_THEME.grid} />

              <XAxis
                type="number"
                dataKey="sales"
                name="Sales"
                tickLine={false}
                axisLine={false}
                label={{
                  value: "Sales",
                  position: "insideBottom",
                  offset: -28,
                }}
              />

              <YAxis
                type="number"
                dataKey="payout"
                name="Payout"
                width={60}
                tickLine={false}
                axisLine={false}
                label={{
                  value: "Payout",
                  angle: -90,
                  position: "insideLeft",
                  offset: 2,
                }}
              />

              <Tooltip
                content={({ payload }) => {
                  if (!payload || !payload.length) {
                    return null;
                  }

                  const data = payload[0].payload;

                  return (
                    <div className="chart-tooltip">
                      <strong>{data.displayName}</strong>

                      <div>Type: {data.type}</div>

                      <div>Sales: {formatMoney(data.sales)}</div>

                      <div>Payout: {formatMoney(data.payout)}</div>

                      <div>Rx: {formatNumber(data.rx)}</div>
                    </div>
                  );
                }}
              />

              <Scatter
                name="Peer Representatives"
                data={peerDistribution}
                fill={CHART_THEME.distribution}
              />

              <Scatter
                name="Current Representative"
                data={representativePoint}
                fill={CHART_THEME.representative}
                shape="diamond"
              />

              <Scatter
                name="Peer Average"
                data={peerAveragePoint}
                fill={CHART_THEME.peer}
                shape="star"
              />

              <Legend
                verticalAlign="top"
                align="center"
                wrapperStyle={{
                  paddingBottom: "8px",
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
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
