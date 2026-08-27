import { motion, useReducedMotion } from "motion/react";

const tracks = [
  "M-20 80 C180 10 310 140 520 62 S850 5 1080 76 S1350 132 1580 42",
  "M-40 260 C170 190 360 330 580 230 S930 165 1160 265 S1420 310 1660 214",
  "M80 510 C250 420 470 570 690 468 S1010 405 1250 506 S1490 550 1700 450",
];

export default function AmbientSignals({ login = false, section = false }: { login?: boolean; section?: boolean }) {
  const reducedMotion = useReducedMotion();

  return (
    <div className={`ambient-signals${login ? " login" : ""}${section ? " section" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 1600 620" preserveAspectRatio="none">
        {tracks.map((path, index) => (
          <g key={path}>
            <path className="ambient-track" d={path} />
            <motion.path
              className="ambient-tracer"
              d={path}
              pathLength={1}
              strokeDasharray="0.025 0.975"
              initial={reducedMotion ? undefined : { strokeDashoffset: 1 }}
              animate={reducedMotion ? undefined : { strokeDashoffset: [1, 0] }}
              transition={{ duration: 8 + index * 2, delay: index * 0.7, repeat: Infinity, repeatType: "loop", ease: "linear" }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
