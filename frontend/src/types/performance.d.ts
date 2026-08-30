type WebVitalName = "CLS" | "FCP" | "INP" | "LCP" | "TTFB";

type WebVitalSnapshot = {
  name: WebVitalName;
  value: number;
  delta: number;
  rating: "good" | "needs-improvement" | "poor";
  id: string;
  navigationType: string;
};

interface Window {
  __WEB_VITALS__?: Partial<Record<WebVitalName, WebVitalSnapshot>>;
  __PERFORMANCE_TOOLS__?: {
    webVitals?: boolean;
    stats?: boolean;
    reactScan?: boolean;
    stop?: () => void;
  };
}
