import { motion } from "motion/react";

type ControlGraphProps = {
  compact?: boolean;
};

const nodes = [
  { cx: 46, cy: 72, delay: 0 },
  { cx: 128, cy: 34, delay: 0.35 },
  { cx: 205, cy: 82, delay: 0.7 },
  { cx: 278, cy: 42, delay: 1.05 },
  { cx: 344, cy: 92, delay: 1.4 },
];

export default function ControlGraph({ compact = false }: ControlGraphProps) {
  return (
    <div className={compact ? "control-graph compact" : "control-graph"} aria-hidden="true">
      <svg viewBox="0 0 390 130" role="presentation">
        <defs>
          <linearGradient id="control-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2563eb" stopOpacity="0.08" />
            <stop offset="0.48" stopColor="#3b82f6" stopOpacity="0.72" />
            <stop offset="1" stopColor="#2563eb" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        <motion.path
          d="M46 72 C78 20 97 18 128 34 S174 94 205 82 S246 22 278 42 S320 106 344 92"
          fill="none"
          stroke="url(#control-line)"
          strokeWidth="1.2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.8, ease: "easeInOut" }}
        />

        <motion.path
          d="M46 72 L205 82 L344 92 M128 34 L278 42"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="0.55"
          strokeDasharray="3 6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.45 }}
          transition={{ delay: 0.8, duration: 1 }}
        />

        {nodes.map((node) => (
          <g key={`${node.cx}-${node.cy}`}>
            <motion.circle
              cx={node.cx}
              cy={node.cy}
              r="9"
              fill="#2563eb"
              opacity="0.08"
              animate={{ scale: [0.78, 1.34, 0.78], opacity: [0.04, 0.15, 0.04] }}
              transition={{ duration: 2.8, delay: node.delay, repeat: Infinity }}
            />
            <motion.circle
              cx={node.cx}
              cy={node.cy}
              r="2.6"
              fill="#2563eb"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.25 + node.delay, stiffness: 260 }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
