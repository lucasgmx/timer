import { Badge } from "@/components/ui/Badge";
import type { InvoiceStatus } from "@/types";

export function InvoiceStatusBadge({
  status
}: {
  status: InvoiceStatus | "uninvoiced" | "invoiced" | "running" | "completed";
}) {
  const tone =
    status === "paid"
      ? "green"
      : status === "unpaid" || status === "invoiced"
        ? "red"
        : status === "uninvoiced" || status === "completed"
          ? "gray"
          : status === "running"
            ? "cyan"
            : "gray";

  return <Badge tone={tone}>{status}</Badge>;
}
