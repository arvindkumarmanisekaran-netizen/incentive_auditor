import { motion, useReducedMotion } from "motion/react";

const nodes = [
  { x: 18, y: 58, delay: 0 }, { x: 78, y: 24, delay: .35 },
  { x: 145, y: 62, delay: .7 }, { x: 214, y: 30, delay: 1.05 },
  { x: 278, y: 66, delay: 1.4 },
];

export default function SignalField3D({ paused = false }: { paused?: boolean }) {
  const reducedMotion = useReducedMotion();

  return (
    <div className="signal-field-3d" aria-hidden="true">
      <svg viewBox="0 0 300 90" preserveAspectRatio="xMidYMid meet">
        <path className="signal-network-guide" d="M18 58 78 24 145 62 214 30 278 66" />
        <motion.path className="signal-network-path" d="M18 58 C42 43 56 29 78 24 S119 55 145 62 S188 39 214 30 S253 54 278 66" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} />
        {nodes.map((node) => (
          <g key={node.x}>
            <motion.circle className="signal-network-halo" cx={node.x} cy={node.y} r="7" animate={reducedMotion || paused ? undefined : { scale: [.86, 1.55, .86], opacity: [.08, .2, .08] }} transition={{ duration: 3, delay: node.delay, repeat: Infinity }} />
            <motion.circle className="signal-network-node" cx={node.x} cy={node.y} r="3" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: .15 + node.delay, stiffness: 260 }} />
          </g>
        ))}
      </svg>
    </div>
  );
}
