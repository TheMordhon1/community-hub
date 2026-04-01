import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, Power } from "lucide-react";
import { cn } from "@/lib/utils";

interface StoreStatusBadgeProps {
  status: string;
  isOpen?: boolean;
  className?: string;
}

export function StoreStatusBadge({ status, isOpen = true, className }: StoreStatusBadgeProps) {
  if (status === "pending") {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "bg-amber-50 text-amber-600 border-amber-200 shadow-sm px-3 py-1 rounded-full text-[10px] font-bold",
          className
        )}
      >
        <Clock className="w-3 h-3 mr-1" />Menunggu Verifikasi
      </Badge>
    );
  }
  
  if (status === "rejected") {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "bg-red-50 text-red-600 border-red-200 shadow-sm px-3 py-1 rounded-full text-[10px] font-bold",
          className
        )}
      >
        <XCircle className="w-3 h-3 mr-1" />Ditolak
      </Badge>
    );
  }
  
  if (status === "approved" && isOpen) {
    return (
      <Badge 
        className={cn(
          "bg-emerald-500 hover:bg-emerald-600 text-white border-none shadow-sm px-3 py-1 rounded-full text-[10px] font-bold",
          className
        )}
      >
        <CheckCircle className="w-3 h-3 mr-1" />Buka
      </Badge>
    );
  }
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "bg-slate-100 text-slate-600 border-slate-200 shadow-sm px-3 py-1 rounded-full text-[10px] font-bold",
        className
      )}
    >
      <Power className="w-3 h-3 mr-1" />Tutup
    </Badge>
  );
}
