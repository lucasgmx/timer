export type ProjectStatus = "active" | "archived";

export type Project = {
  id: string;
  name: string;
  clientName?: string | null;
  defaultHourlyRateCents: number;
  currency: "USD";
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
};
