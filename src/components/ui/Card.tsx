import type { HTMLAttributes, ReactNode } from "react";
import "./ui.css";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  eyebrow?: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
};

export function Card({
  title,
  eyebrow,
  subtitle,
  action,
  icon,
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <section className={`ui-card ${className}`} {...props}>
      {(title || eyebrow || subtitle || action || icon) && (
        <div className="ui-card-header">
          <div className="ui-card-header-main">
            {icon ? <span className="ui-card-icon">{icon}</span> : null}
            <div>
              {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
              {title ? <h2 className="section-title">{title}</h2> : null}
              {subtitle ? <div className="muted">{subtitle}</div> : null}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
