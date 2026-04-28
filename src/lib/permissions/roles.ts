import type { UserRole } from "@/types/User";

export const ROLES: UserRole[] = ["admin", "user"];

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "user";
}

export function hasRole(role: UserRole, allowedRoles: UserRole[]) {
  return allowedRoles.includes(role);
}

export function canManageBilling(role: UserRole) {
  return role === "admin";
}

export function canManageSettings(role: UserRole) {
  return role === "admin";
}

export function canEditTimeEntry(role: UserRole, ownerUserId: string, actorUserId: string) {
  return role === "admin" || ownerUserId === actorUserId;
}
