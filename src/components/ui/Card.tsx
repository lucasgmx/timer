import type { HTMLAttributes, ReactNode } from "react";
import "./ui.css";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
};

export function Card({
  title,
  eyebrow,
  action,
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <section className={`ui-card ${className}`} {...props}>
      {(title || eyebrow || action) && (
        <div className="ui-card-header">
          <div>
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            {title ? <h2 className="section-title">{title}</h2> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
