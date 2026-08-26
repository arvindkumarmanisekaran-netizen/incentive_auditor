import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import "@fontsource-variable/manrope";
import "@fontsource/ibm-plex-mono/500.css";
import "./styles/index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <App />
    </MotionConfig>
  </StrictMode>,
);
