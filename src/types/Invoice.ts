export type InvoiceStatus = "unpaid" | "paid" | "void";

export type InvoiceLineItem = {
  timeEntryId: string;
  taskId: string;
  taskTitle: string;
  userId: string;
  dateKey: string;
  durationSeconds: number;
  hoursDecimal: number;
  hourlyRateCents: number;
  amountCents: number;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  status: InvoiceStatus;
  dateRange: {
    start: string;
    end: string;
  };
  lineItems: InvoiceLineItem[];
  subtotalCents: number;
  totalCents: number;
  currency: "USD";
  createdAt: Date;
  sentAt?: Date | null;
  paidAt?: Date | null;
  dueDate?: string | null;
};
