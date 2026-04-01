import { Badge } from "@/components/ui/badge";
import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface StoreCategoryBadgeProps {
  category: string;
  className?: string;
  size?: "sm" | "md";
}

export function StoreCategoryBadge({ category, className, size = "md" }: StoreCategoryBadgeProps) {
  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "uppercase tracking-tighter bg-primary/10 text-primary border-primary/20",
        size === "sm" ? "text-[9px] h-4 px-1.5 font-black border-none" : "text-[10px] py-0.5",
        className
      )}
    >
      <Tag className={cn("mr-1", size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3")} />
      {category}
    </Badge>
  );
}
