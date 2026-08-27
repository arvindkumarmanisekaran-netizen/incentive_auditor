import { useEffect } from "react";

const TILT_SELECTOR = [
  ".chart-card", ".insight-card", ".analysis-card", ".workflow-card",
  ".kpi-item", ".finding-card", ".risk-driver-card", ".decision-status",
  ".decision-assessment", ".decision-findings", ".database-table-container", ".admin-card",
].join(",");

export default function CardTiltController() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let activeCard: HTMLElement | null = null;
    let frame = 0;

    const resetCard = (card: HTMLElement | null) => {
      if (!card) return;
      card.classList.remove("is-pointer-tilting");
      card.style.removeProperty("--pointer-tilt-x");
      card.style.removeProperty("--pointer-tilt-y");
      card.style.removeProperty("--pointer-glare-x");
      card.style.removeProperty("--pointer-glare-y");
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const card = (event.target as Element | null)?.closest<HTMLElement>(TILT_SELECTOR) ?? null;
      if (card !== activeCard) {
        resetCard(activeCard);
        activeCard = card;
      }
      if (!card) return;

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const px = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const py = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        card.style.setProperty("--pointer-tilt-x", `${((.5 - py) * 5).toFixed(2)}deg`);
        card.style.setProperty("--pointer-tilt-y", `${((px - .5) * 7).toFixed(2)}deg`);
        card.style.setProperty("--pointer-glare-x", `${(px * 100).toFixed(1)}%`);
        card.style.setProperty("--pointer-glare-y", `${(py * 100).toFixed(1)}%`);
        card.classList.add("is-pointer-tilting");
      });
    };

    const handlePointerOut = (event: PointerEvent) => {
      if (!activeCard || activeCard.contains(event.relatedTarget as Node | null)) return;
      resetCard(activeCard);
      activeCard = null;
    };

    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerout", handlePointerOut, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      resetCard(activeCard);
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerout", handlePointerOut);
    };
  }, []);

  return null;
}
