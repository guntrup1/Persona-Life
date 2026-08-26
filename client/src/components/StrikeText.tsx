import { motion } from "framer-motion";
import { ReactNode } from "react";

export function StrikeText({
  completed,
  children,
  className,
}: {
  completed: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`relative inline ${className || ""}`}>
      <span className={completed ? "text-muted-foreground" : "text-foreground"}>{children}</span>
      <motion.span
        className="absolute left-0 top-1/2 h-px w-full bg-current"
        initial={false}
        animate={{ scaleX: completed ? 1 : 0 }}
        transition={{ duration: 0.28, ease: "easeInOut" }}
        style={{ originX: 0, transform: "translateY(-50%)" }}
      />
    </span>
  );
}
