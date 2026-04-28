import type { HTMLAttributes, ReactNode } from "react";
import "./ui.css";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  icon?: ReactNode;
};

export function Card({
  title,
  eyebrow,
  action,
  icon,
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <section className={`ui-card ${className}`} {...props}>
      {(title || eyebrow || action || icon) && (
        <div className="ui-card-header">
          <div className="ui-card-header-main">
            {icon ? <span className="ui-card-icon">{icon}</span> : null}
            <div>
              {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
              {title ? <h2 className="section-title">{title}</h2> : null}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
