import { motion } from "motion/react";
import type { ReactNode } from "react";

interface AnimateOnViewProps {
  children: ReactNode;
}

export function AnimateOnView({ children }: AnimateOnViewProps) {
  return (
    <motion.div
      className="signal-scroll-animation"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -36px 0px" }}
      transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
