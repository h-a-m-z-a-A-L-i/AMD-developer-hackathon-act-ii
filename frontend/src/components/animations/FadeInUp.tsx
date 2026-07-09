"use client";

import { motion, HTMLMotionProps } from "framer-motion";

export function FadeInUp({ children, className, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
