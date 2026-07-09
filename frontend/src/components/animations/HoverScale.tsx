"use client";

import { motion, HTMLMotionProps } from "framer-motion";

interface HoverScaleProps extends HTMLMotionProps<"div"> {
  hoverScale?: number;
  tapScale?: number;
}

export function HoverScale({ 
  children, 
  className, 
  hoverScale = 1.02,
  tapScale = 0.98,
  ...props 
}: HoverScaleProps) {
  return (
    <motion.div
      className={className}
      whileHover={{ scale: hoverScale }}
      whileTap={{ scale: tapScale }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
