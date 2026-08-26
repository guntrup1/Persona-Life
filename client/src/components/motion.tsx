import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const dialogMotion = {
  initial: { opacity: 0, scale: 0.96, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 6 },
  transition: { type: "spring", stiffness: 320, damping: 28 },
} as const;

export function MotionDialogContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div {...dialogMotion} className={className}>
      {children}
    </motion.div>
  );
}

export function MotionList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div layout className={className}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </motion.div>
  );
}

export function MotionItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
