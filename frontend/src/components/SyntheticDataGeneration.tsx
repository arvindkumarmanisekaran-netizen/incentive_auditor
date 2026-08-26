import { useEffect, useState } from "react";
import AppIcon from "./AppIcon";

export default function SyntheticDataGeneration() {
  const [isGeneratingSyntheticData, setIsGeneratingSyntheticData] = useState(false);

  const [generationMessages, setGenerationMessages] = useState<string[]>([]);

  const [isMobile, setIsMobile] = useState(window.matchMedia("(max-width: 650px)").matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 650px)");

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  async function handleSyntheticDataGeneration() {
    const filename = "synthetic_dataset.zip";

    let eventSource: EventSource | null = null;

    try {
      setIsGeneratingSyntheticData(true);

      setGenerationMessages(["Starting synthetic data generation..."]);

      /*
       * Start generation job
       */

      const startResponse = await fetch("/api/generate-synthetic/start", {
        method: "POST",
      });

      if (!startResponse.ok) {
        throw new Error("Could not start synthetic generation");
      }

      const { job_id } = await startResponse.json();

      /*
       * Connect SSE stream
       */

      eventSource = new EventSource(`/api/generate-synthetic/stream/${job_id}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (!data.message || data.message === "__COMPLETE__") {
            return;
          }

          setGenerationMessages((current) => [...current, data.message]);
        } catch {
          console.warn("Invalid SSE message", event.data);
        }
      };

      /*
       * Wait for completed zip
       */

      let attempts = 0;

      while (attempts < 300) {
        attempts += 1;

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const statusResponse = await fetch(`/api/generate-synthetic/status/${job_id}`);

        const status = await statusResponse.json();

        if (!status.ready) {
          continue;
        }

        const downloadResponse = await fetch(`/api/generate-synthetic/download/${job_id}`);

        if (!downloadResponse.ok) {
          throw new Error("Synthetic download failed");
        }

        const contentType = downloadResponse.headers.get("content-type");

        if (!contentType || !contentType.includes("application/zip")) {
          continue;
        }

        /*
         * Download file
         */

        const blob = await downloadResponse.blob();

        const url = window.URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;

        link.download = filename;

        document.body.appendChild(link);

        link.click();

        link.remove();

        window.URL.revokeObjectURL(url);

        setGenerationMessages((current) => [...current, "✓ Download completed"]);

        break;
      }
    } catch (error) {
      console.error("Synthetic generation failed:", error);

      setGenerationMessages((current) => [...current, "✕ Synthetic data generation failed"]);
    } finally {
      eventSource?.close();

      setIsGeneratingSyntheticData(false);

      setTimeout(() => {
        setGenerationMessages([]);
      }, 8000);
    }
  }

  return (
    <div className="database-actions">
      {/* Synthetic Data Generation */}

      <button
        type="button"
        className="synthetic-data-button"
        onClick={handleSyntheticDataGeneration}
        disabled={isGeneratingSyntheticData}
        title="Generate downloadable synthetic database dataset"
      >
        <span className="synthetic-data-icon" aria-hidden="true">
          <AppIcon name="dna" size={18} />
        </span>

        <span className="synthetic-data-title">
          {isGeneratingSyntheticData ? "Generating Dataset..." : "Generate Synthetic Data"}
        </span>
      </button>

      {generationMessages.length > 0 && (
        <div className="download-toast">
          <div className="download-toast-row">
            <span className="download-toast-title"><AppIcon name="dna" size={15} /> Synthetic Data Generation</span>

            {generationMessages.slice(isMobile ? -3 : -5).map((message, index) => (
              <span key={index} className="download-toast-message">
                › {message}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
