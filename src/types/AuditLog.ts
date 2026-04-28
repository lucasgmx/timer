import type { UserRole } from "./User";

export type AuditAction =
  | "invoice.created"
  | "invoice.sent"
  | "invoice.paid"
  | "invoice.voided"
  | "timeEntry.created"
  | "timeEntry.updated"
  | "timeEntry.stopped"
  | "task.upserted"
  | "user.roleChanged";

export type AuditLog = {
  id: string;
  action: AuditAction;
  actorUserId: string;
  actorRole: UserRole;
  targetCollection: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};
