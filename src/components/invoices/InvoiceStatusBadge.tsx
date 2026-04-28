import { Badge } from "@/components/ui/Badge";
import type { InvoiceStatus } from "@/types";

export function InvoiceStatusBadge({
  status
}: {
  status: InvoiceStatus | "uninvoiced" | "invoiced" | "running" | "completed";
}) {
  const tone =
    status === "paid"
      ? "blue"
      : status === "sent" || status === "invoiced"
        ? "cyan"
        : status === "draft" || status === "uninvoiced" || status === "completed"
          ? "green"
          : status === "overdue"
            ? "amber"
            : "red";

  return <Badge tone={tone}>{status}</Badge>;
}
