import { useState } from "react";

import type { Finding, PeerAnalysis as PeerAnalysisType } from "../types/investigation";

import ProductAnalysis from "./analysis/ProductAnalysis";
import BehaviourAnalysis from "./analysis/BehaviourAnalysis";
import HistoricalAnalysis from "./analysis/HistoricalAnalysis";
import PeerAnalysis from "./analysis/PeerAnalysis";

type Props = {
  findings: Finding[];
  peerAnalysis?: PeerAnalysisType;
  representativeID?: string;
};

type AnalysisTab = "product" | "historical" | "peer" | "behaviour";

function AnalysisTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "analysis-tab active" : "analysis-tab"}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function AnalysisWorkspace({ representativeID, findings, peerAnalysis }: Props) {
  const [activeTab, setActiveTab] = useState<AnalysisTab>("product");

  return (
    <section className="analysis-workspace">
      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="analysis-workspace-header section-heading">
        <div>
          <h2>Investigation Evidence</h2>

          <p>
            Review supporting evidence across products, peer benchmarks, doctor and territory
            behaviour, and historical trends.
          </p>
        </div>
      </div>

      {/* ==================================================
          TABS
      ================================================== */}

      <nav className="analysis-tabs">
        <AnalysisTabButton active={activeTab === "product"} onClick={() => setActiveTab("product")}>
          Sales &amp; Products
        </AnalysisTabButton>

        <AnalysisTabButton active={activeTab === "peer"} onClick={() => setActiveTab("peer")}>
          Peer Benchmark
        </AnalysisTabButton>

        <AnalysisTabButton
          active={activeTab === "behaviour"}
          onClick={() => setActiveTab("behaviour")}
        >
          Doctor &amp; Territory
        </AnalysisTabButton>

        <AnalysisTabButton
          active={activeTab === "historical"}
          onClick={() => setActiveTab("historical")}
        >
          Trend History
        </AnalysisTabButton>
      </nav>

      {/* ==================================================
          CONTENT
      ================================================== */}

      <div className="analysis-workspace-content">
        {activeTab === "product" && <ProductAnalysis findings={findings} />}

        {activeTab === "peer" && (
          <PeerAnalysis peerAnalysis={peerAnalysis} representativeId={representativeID} />
        )}

        {activeTab === "behaviour" && <BehaviourAnalysis findings={findings} />}

        {activeTab === "historical" && <HistoricalAnalysis findings={findings} />}
      </div>
    </section>
  );
}
