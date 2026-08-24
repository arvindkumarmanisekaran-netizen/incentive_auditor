import { useState } from "react";

import type { Finding, PeerAnalysis as PeerAnalysisType } from "../types/investigation";

import ProductAnalysis from "./analysis/ProductAnalysis";
import BehaviourAnalysis from "./analysis/BehaviourAnalysis";
import HistoricalAnalysis from "./analysis/HistoricalAnalysis";

import PeerAnalysis from "./analysis/PeerAnalysis";

type Props = {
  findings: Finding[];
  peerAnalysis?: PeerAnalysisType;
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

export default function AnalysisWorkspace({ findings, peerAnalysis }: Props) {
  const [activeTab, setActiveTab] = useState<AnalysisTab>("product");

  return (
    <section className="analysis-workspace">
      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="analysis-workspace-header section-heading">
        <div>
          <h2>Analysis Workspace</h2>

          <p>
            Explore investigation evidence across products, history, peers and behaviour patterns.
          </p>
        </div>
      </div>

      {/* ==================================================
          TABS
      ================================================== */}

      <nav className="analysis-tabs">
        <AnalysisTabButton active={activeTab === "product"} onClick={() => setActiveTab("product")}>
          Product
        </AnalysisTabButton>

        <AnalysisTabButton
          active={activeTab === "historical"}
          onClick={() => setActiveTab("historical")}
        >
          Historical
        </AnalysisTabButton>

        <AnalysisTabButton active={activeTab === "peer"} onClick={() => setActiveTab("peer")}>
          Peer
        </AnalysisTabButton>

        <AnalysisTabButton
          active={activeTab === "behaviour"}
          onClick={() => setActiveTab("behaviour")}
        >
          Behaviour
        </AnalysisTabButton>
      </nav>

      {/* ==================================================
          CONTENT
      ================================================== */}

      <div className="analysis-workspace-content">
        {activeTab === "product" && <ProductAnalysis findings={findings} />}

        {activeTab === "behaviour" && <BehaviourAnalysis findings={findings} />}

        {activeTab === "historical" && <HistoricalAnalysis findings={findings} />}

        {activeTab === "peer" && <PeerAnalysis peerAnalysis={peerAnalysis} />}
      </div>
    </section>
  );
}
