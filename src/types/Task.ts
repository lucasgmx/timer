export type TaskStatus = "active" | "archived";

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  hourlyRateCentsOverride?: number | null;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
};
