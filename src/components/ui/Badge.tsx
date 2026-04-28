import type { HTMLAttributes } from "react";
import "./ui.css";

type BadgeTone = "green" | "cyan" | "amber" | "blue" | "red" | "gray";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ tone = "gray", className = "", children, ...props }: BadgeProps) {
  return (
    <span className={`ui-badge ${tone} ${className}`} {...props}>
      {children}
    </span>
  );
}
