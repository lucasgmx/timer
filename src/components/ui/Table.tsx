import type { TableHTMLAttributes } from "react";
import "./ui.css";

export function Table({
  className = "",
  children,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="ui-table-wrap">
      <table className={`ui-table ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}
