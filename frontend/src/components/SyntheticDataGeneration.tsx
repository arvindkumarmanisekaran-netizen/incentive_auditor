import { useState } from "react";

type Props = {
  showDocumentProcessing: boolean;
  onToggleDocumentProcessing: () => void;
};

export default function SyntheticDataGeneration({
  showDocumentProcessing,
  onToggleDocumentProcessing,
}: Props) {
  const [isGeneratingSyntheticData, setIsGeneratingSyntheticData] = useState(false);

  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  async function handleSyntheticDataGeneration() {
    const filename = "synthetic_data.zip";

    try {
      setIsGeneratingSyntheticData(true);

      setDownloadStatus(`Downloading ${filename}...`);

      const response = await fetch("/api/generate-synthetic", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Synthetic data generation failed");
      }

      const syntheticDataFile = await response.blob();

      const downloadUrl = window.URL.createObjectURL(syntheticDataFile);

      const downloadLink = document.createElement("a");

      downloadLink.href = downloadUrl;

      downloadLink.download = filename;

      document.body.appendChild(downloadLink);

      downloadLink.click();

      downloadLink.remove();

      window.URL.revokeObjectURL(downloadUrl);

      setDownloadStatus("✓ Download completed");

      setTimeout(() => {
        setDownloadStatus(null);
      }, 3000);
    } catch (error) {
      console.error("Synthetic data generation failed:", error);

      setDownloadStatus("✕ Synthetic data generation failed");

      setTimeout(() => {
        setDownloadStatus(null);
      }, 3000);
    } finally {
      setIsGeneratingSyntheticData(false);
    }
  }

  return (
    <div className="database-actions">
      {/* Add Records */}

      <button
        type="button"
        className={`document-plus-button ${showDocumentProcessing ? "minus-state" : "plus-state"}`}
        onClick={onToggleDocumentProcessing}
        title={showDocumentProcessing ? "Hide Add Records" : "Add Records"}
      >
        <span className="folder-toggle-icon" aria-hidden="true">
          📁
        </span>

        <span className="folder-toggle-title">
          {showDocumentProcessing ? "Close Records" : "Add Records"}
        </span>
      </button>

      {/* Synthetic Data Generation */}

      <button
        type="button"
        className="synthetic-data-button"
        onClick={handleSyntheticDataGeneration}
        disabled={isGeneratingSyntheticData}
        title="Generate downloadable synthetic database dataset"
      >
        <span className="synthetic-data-icon" aria-hidden="true">
          🧬
        </span>

        <span className="synthetic-data-title">
          {isGeneratingSyntheticData ? "Generating..." : "Generate Synthetic Data"}
        </span>
      </button>

      {downloadStatus && (
        <div className="download-toast">
          <span className="download-toast-icon">
            {downloadStatus.startsWith("✓") ? "✓" : downloadStatus.startsWith("✕") ? "!" : "🧬"}
          </span>

          <span>{downloadStatus.replace("✓ ", "").replace("✕ ", "")}</span>
        </div>
      )}
    </div>
  );
}
