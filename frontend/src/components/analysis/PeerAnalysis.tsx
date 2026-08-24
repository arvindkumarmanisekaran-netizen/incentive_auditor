import type { Finding } from "../../types/investigation";

type Props = {
  findings?: Finding[];
};

export default function PeerAnalysis({ findings = [] }: Props) {
  return (
    <section className="peer-analysis-section">
      <div className="analysis-section-header">
        <div>
          <h2>Peer Analysis</h2>

          <p>Representative performance compared against peer population.</p>
        </div>
      </div>

      <div className="peer-analysis-grid">
        <div className="chart-card">
          <h3>Rep vs Peer Average</h3>

          <p>Performance comparison against similar representatives.</p>

          <div className="peer-metrics">...</div>
        </div>

        <div className="chart-card">
          <h3>Percentile Position</h3>
          <p>Relative ranking within peer group.</p>
          ...
        </div>

        <div className="chart-card">
          <h3>Peer Distribution</h3>
          ...
        </div>

        <div className="chart-card">
          <h3>Peer Anomaly Indicators</h3>
          ...
        </div>
      </div>
    </section>
  );
}
