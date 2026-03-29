import { Badge } from "@/components/ui/badge";
import { BorrowStatus } from "../types";

const STATUS_CONFIG: Record<BorrowStatus, { label: string; className: string }> = {
  pending:  { label: "Menunggu",     className: "bg-yellow-500/20 text-yellow-700 border-yellow-300" },
  approved: { label: "Disetujui",    className: "bg-blue-500/20 text-blue-700 border-blue-300" },
  borrowed: { label: "Dipinjam",     className: "bg-purple-500/20 text-purple-700 border-purple-300" },
  returned: { label: "Dikembalikan", className: "bg-green-500/20 text-green-700 border-green-300" },
  rejected: { label: "Ditolak",      className: "" },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as BorrowStatus];
  if (!cfg) return <Badge variant="outline">{status}</Badge>;
  if (status === "rejected") return <Badge variant="destructive">{cfg.label}</Badge>;
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}
