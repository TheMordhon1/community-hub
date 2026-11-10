import type { AppRole, PengurusTitle } from "@/types/database";

export function canSearchAllPayments(
  role: AppRole | null,
  title: PengurusTitle | null,
  hasFinanceAccess: boolean,
): boolean {
  return role === "admin" || title === "menteri_sisdigi" || (role === "pengurus" && hasFinanceAccess);
}