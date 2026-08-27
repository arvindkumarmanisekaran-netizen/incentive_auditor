import { motion, useReducedMotion } from "motion/react";

import "../styles/holographic-command-center.css";

type SignalField3DProps = { active?: boolean; complete?: boolean; riskScore?: number };

const bars = [18, 31, 24, 43, 29, 36];
const particles = [
  { cx: 75, cy: 76, delay: 0 }, { cx: 123, cy: 47, delay: .8 },
  { cx: 268, cy: 45, delay: 1.6 }, { cx: 315, cy: 78, delay: 2.4 },
];

export default function SignalField3D({ active = false, complete = false, riskScore = 0 }: SignalField3DProps) {
  const reducedMotion = useReducedMotion();
  const stateLabel = active ? "ANALYZING" : complete ? "SYNTHESIZED" : "MONITORING";
  const score = Math.max(0, Math.min(100, Math.round(riskScore)));

  return (
    <div className={`signal-field-3d holographic-command-center${active ? " is-active" : ""}${complete ? " is-complete" : ""}`} aria-hidden="true">
      <div className="holo-status"><span />{stateLabel}</div>
      <svg viewBox="0 0 390 150" role="presentation" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="holoPanel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#eff7ff" stopOpacity=".96" /><stop offset="1" stopColor="#dbeafe" stopOpacity=".42" /></linearGradient>
          <linearGradient id="holoPlatform" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#bfdbfe" stopOpacity=".56" /><stop offset=".55" stopColor="#60a5fa" stopOpacity=".2" /><stop offset="1" stopColor="#1d4ed8" stopOpacity=".4" /></linearGradient>
          <linearGradient id="holoBar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#2563eb" /><stop offset=".55" stopColor="#38bdf8" /><stop offset="1" stopColor="#e0f2fe" /></linearGradient>
          <filter id="holoGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        <g className="holo-back-grid">
          {[70, 84, 98, 112].map((y) => <path key={y} d={`M92 ${y} L195 ${y - 35} L303 ${y} L195 ${y + 36} Z`} />)}
          {[120, 145, 170, 220, 245, 270].map((x) => <path key={x} d={`M${x} 52 L${x + 76} 78 L${x} 105 L${x - 76} 78 Z`} />)}
        </g>

        <motion.g className="holo-panel holo-panel-sales" initial={{ opacity: 0, x: 10, y: 8 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ duration: .8, ease: "easeOut" }}>
          <path className="holo-panel-surface" d="M18 23 L132 9 L132 65 L18 79 Z" /><text x="29" y="34">SALES SIGNAL</text>
          <path className="holo-chart-grid" d="M29 45 L121 34 M29 56 L121 45 M29 67 L121 56" />
          <motion.path className="holo-chart-line" d="M29 63 C44 58 48 43 62 50 S82 60 91 42 S109 47 121 31" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: .25 }} /><circle className="holo-chart-point" cx="91" cy="42" r="2" />
        </motion.g>

        <motion.g className="holo-panel holo-panel-risk" initial={{ opacity: 0, x: -10, y: 8 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ duration: .8, delay: .1, ease: "easeOut" }}>
          <path className="holo-panel-surface" d="M259 9 L372 23 L372 79 L259 65 Z" /><text x="271" y="29">RISK SYNTHESIS</text>
          <circle className="holo-risk-track" cx="287" cy="45" r="12" />
          <motion.circle className="holo-risk-value" cx="287" cy="45" r="12" pathLength="100" strokeDasharray={`${complete ? score : 64} 100`} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: -90, opacity: 1 }} transition={{ duration: .8, delay: .45 }} />
          <text className="holo-score" x="287" y="48" textAnchor="middle">{complete ? score : "AI"}</text><path className="holo-mini-bars" d="M311 57 V45 M319 57 V37 M327 57 V48 M335 57 V31 M343 57 V41 M351 57 V27" />
        </motion.g>

        <motion.g className="holo-panel holo-panel-payout" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .75, delay: .2 }}><path className="holo-panel-surface" d="M116 4 L220 4 L241 28 L137 28 Z" /><text x="133" y="16">PAYOUT VALIDATION</text><path className="holo-payout-line" d="M137 21 L155 18 L171 20 L188 13 L207 17 L225 10" /></motion.g>
        <motion.g className="holo-panel holo-panel-peer" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .75, delay: .3 }}><path className="holo-panel-surface" d="M139 116 L243 116 L222 141 L118 141 Z" /><text x="144" y="131">PEER INDEX</text><path className="holo-peer-line" d="M188 136 L195 121 L202 136 M178 136 L195 126 L212 136" /></motion.g>

        <g className="holo-platform" filter="url(#holoGlow)">
          <path className="holo-platform-shadow" d="M94 94 L194 59 L300 94 L195 132 Z" /><path className="holo-platform-side" d="M94 94 L195 132 L195 141 L94 103 Z M195 132 L300 94 L300 103 L195 141 Z" />
          <path className="holo-platform-top" d="M94 91 L194 56 L300 91 L195 128 Z" /><path className="holo-platform-core" d="M130 91 L194 69 L263 91 L195 115 Z" />
          <motion.path className="holo-platform-orbit" d="M118 91 L194 64 L276 91 L195 120 Z" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.3, delay: .35 }} />
        </g>

        <g className="holo-bars">
          {bars.map((height, index) => { const x = 151 + index * 17; const baseY = 99 + Math.abs(2.5 - index) * 3; return (
            <motion.g key={x} initial={{ opacity: 0, scaleY: .05 }} animate={{ opacity: 1, scaleY: 1 }} transition={{ duration: .7, delay: .55 + index * .08, ease: [0.22, 1, 0.36, 1] }} style={{ transformOrigin: `${x}px ${baseY}px` }}>
              <path className="holo-bar-front" d={`M${x} ${baseY - height} l9 3 v${height} l-9 -3 Z`} /><path className="holo-bar-side" d={`M${x + 9} ${baseY - height + 3} l5 -3 v${height} l-5 3 Z`} /><path className="holo-bar-top" d={`M${x} ${baseY - height} l5 -3 l9 3 l-5 3 Z`} />
            </motion.g> ); })}
        </g>

        <g className="holo-core"><motion.ellipse cx="195" cy="91" rx="23" ry="9" animate={reducedMotion ? undefined : { scale: [1, 1.18, 1], opacity: [.55, .95, .55] }} transition={{ duration: active ? 1.1 : 2.8, repeat: Infinity }} /><circle cx="195" cy="91" r="3" /></g>
        {!reducedMotion && particles.map((particle) => <motion.circle key={particle.cx} className="holo-particle" r="1.6" initial={{ cx: particle.cx, cy: particle.cy, opacity: 0 }} animate={{ cx: [particle.cx, 195, 315 - particle.cx / 3], cy: [particle.cy, 91, 43], opacity: [0, 1, 0] }} transition={{ duration: active ? 2.2 : 4.8, delay: particle.delay, repeat: Infinity, ease: "easeInOut" }} />)}
      </svg>
      <div className="holo-floor-glow" />
    </div>
  );
}
