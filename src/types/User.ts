export type UserRole = "admin" | "user";

export type AppUser = {
  id: string;
  username: string;
  email: string;
  displayName?: string | null;
  role: UserRole;
  active: boolean;
  runningTimeEntryId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
