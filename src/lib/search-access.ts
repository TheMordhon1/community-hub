import type { AppRole, PengurusTitle } from "@/types/database";

export function canSearchAllPayments(
  role: AppRole | null,
  title: PengurusTitle | null,
  hasFinanceAccess: boolean,
): boolean {
  return role === "admin" || title === "menteri_sisdigi" || (role === "pengurus" && hasFinanceAccess);
}

export function getUnpaidHouseIds(
  houseIds: string[],
  payments: Array<{ house_id: string; status: string | null }>,
): string[] {
  const paidHouseIds = new Set(payments.filter((payment) => payment.status === "paid").map((payment) => payment.house_id));
  return houseIds.filter((houseId) => !paidHouseIds.has(houseId));
}