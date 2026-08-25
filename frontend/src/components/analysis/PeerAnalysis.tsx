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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ReferenceLine,
  ReferenceDot,
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

  // prevent radar explosion

  return Math.min(Math.round((value / average) * 100), 200);
}

export default function PeerAnalysis({ representativeId, peerAnalysis }: Props) {
  const comparison = peerAnalysis?.product_peer_comparison;

  if (!comparison?.products) {
    return (
      <section className="peer-analysis-section">
        <div className="analysis-panel-header analysis-section-header">
          <div>
            <h3>Peer Analysis</h3>

            <p>Explore representative performance against available peer population.</p>
          </div>
        </div>

        <div className="chart-card">No peer comparison data available.</div>
      </section>
    );
  }

  const products = comparison.products;

  const productEntries = Object.entries(products);

  /*
    Bar chart
  */

  const comparisonData = productEntries.map(([id, item]) => ({
    product: `${item.product_name} (${id})`,

    representative: item.representative.sales,

    peer: item.peer_average.sales,
  }));

  /*
    First product profile
  */

  const selected = productEntries[0]?.[1];

  const radarData = selected
    ? [
        {
          metric: "Sales",

          Representative: normalize(selected.representative.sales, selected.peer_average.sales),

          Peer: 100,
        },

        {
          metric: "Prescription",

          Representative: normalize(selected.representative.rx, selected.peer_average.rx),

          Peer: 100,
        },

        {
          metric: "Payout",

          Representative: normalize(selected.representative.payout, selected.peer_average.payout),

          Peer: 100,
        },
      ]
    : [];

  /*
    Scatter distribution
  */

  const peerDistribution =
    selected?.peer_distribution.map((peer) => ({
      id: peer.representative_id,

      name: peer.representative_name,

      displayName: `${peer.representative_name} (${peer.representative_id})`,

      sales: peer.sales,

      payout: peer.payout,

      rx: peer.rx,

      type: "Peer",
    })) ?? [];

  const representativePoint = selected
    ? [
        {
          id: "Current Representative",

          name: selected.representative_name,

          displayName: `${selected.representative_name} (${representativeId})`,

          sales: selected.representative.sales,

          payout: selected.representative.payout,

          rx: selected.representative.rx,

          type: "Current Representative",
        },
      ]
    : [];

  const peerAveragePoint = selected
    ? [
        {
          id: "Peer Average",

          name: "Peer Average",

          sales: selected.peer_average.sales,

          payout: selected.peer_average.payout,

          rx: selected.peer_average.rx,

          type: "Peer Average",
        },
      ]
    : [];

  return (
    <section className="peer-analysis-section">
      <div className="analysis-panel-header analysis-section-header">
        <div>
          <h3>Peer Analysis</h3>

          <p>
            Explore investigation evidence across products, history, peers and behaviour patterns.
          </p>
        </div>
      </div>

      <div className="peer-analysis-grid">
        {/* ======================
            SALES COMPARISON
        ======================= */}

        <div className="chart-card">
          <h3>Representative vs Peer Average</h3>

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

        {/* ======================
            RADAR
        ======================= */}

        <div className="chart-card">
          <h3>Relative Position</h3>

          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData}>
              <PolarGrid />

              <PolarAngleAxis dataKey="metric" />

              <PolarRadiusAxis domain={[0, 200]} />

              <Radar
                name="Representative"
                dataKey="Representative"
                stroke={CHART_THEME.representative}
                fill={CHART_THEME.representative}
                fillOpacity={0.35}
              />

              <Radar
                name="Peer Average"
                dataKey="Peer"
                stroke={CHART_THEME.peer}
                fill={CHART_THEME.peer}
                fillOpacity={0.25}
              />

              <Legend />

              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* ======================
            DISTRIBUTION
        ======================= */}

        <div className="chart-card">
          <h3>Peer Distribution</h3>

          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart
              margin={{
                top: 30,
                right: 40,
                bottom: 40,
                left: 50,
              }}
            >
              <CartesianGrid stroke={CHART_THEME.grid} />

              <XAxis
                type="number"
                dataKey="sales"
                name="Sales"
                label={{
                  value: "Sales",
                  position: "insideBottom",
                  offset: -10,
                }}
              />

              <YAxis
                type="number"
                dataKey="payout"
                name="Payout"
                label={{
                  value: "Payout",
                  angle: -90,
                  position: "insideLeft",
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

                      <div>Sales: {data.sales?.toLocaleString()}</div>

                      <div>Payout: {data.payout?.toLocaleString()}</div>

                      <div>RX: {data.rx?.toLocaleString()}</div>
                    </div>
                  );
                }}
              />

              {/* Peer representatives */}

              <Scatter
                name="Peer Representatives"
                data={peerDistribution}
                fill={CHART_THEME.distribution}
              />

              {/* Current Representative */}

              <Scatter
                name="Current Representative"
                data={representativePoint}
                fill={CHART_THEME.representative}
                shape="diamond"
              />

              {/* Peer Average */}

              <Scatter
                name="Peer Average"
                data={peerAveragePoint}
                fill={CHART_THEME.peer}
                shape="star"
              />

              <Legend />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* ======================
            STATUS CARDS
        ======================= */}

        <div className="chart-card peer-indicator-card">
          <h3>Peer Indicators</h3>

          <div className="product-status-grid">
            {productEntries.map(([id, item]) => (
              <div
                key={id}
                data-tooltip={`${item.product_name} (${id})`}
                className={
                  item.anomaly_detected
                    ? "product-status-card review-card"
                    : "product-status-card normal-card"
                }
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
