import { useEffect } from "react";
import { Search } from "lucide-react";
import { useSmartSearchStore } from "@/stores/smartSearchStore";
import { SmartSearchDialog } from "./SmartSearchDialog";
import { cn } from "@/lib/utils";

interface SmartSearchTriggerProps {
  className?: string;
  variant?: "header" | "card" | "compact";
  placeholder?: string;
}

export function SmartSearchTrigger({
  className,
  variant = "header",
  placeholder = "Pencarian pintar... (⌘K)",
}: SmartSearchTriggerProps) {
  const { isOpen, setIsOpen, open } = useSmartSearchStore();

  // Global keyboard shortcut: Cmd+K / Ctrl+K and '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is already typing in an input, textarea or contentEditable
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(!isOpen);
        return;
      }

      if (e.key === "/" && !isInput && !isOpen) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setIsOpen]);

  return (
    <>
      {variant === "header" && (
        <button
          type="button"
          onClick={open}
          className={cn(
            "group flex items-center justify-between gap-2 px-3 py-1.5 h-9 rounded-full",
            "border border-border/70 bg-muted/40 hover:bg-muted/80 text-muted-foreground hover:text-foreground",
            "transition-all duration-150 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "w-auto md:w-64 lg:w-80",
            className
          )}
          aria-label="Buka Pencarian Pintar"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-primary shrink-0 transition-transform group-hover:scale-110" />
            <span className="hidden sm:inline-block truncate font-normal">
              {placeholder}
            </span>
            <span className="inline-block sm:hidden font-medium">Cari...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground/80 shadow-2xs">
            <span className="text-[11px]">⌘</span>K
          </kbd>
        </button>
      )}

      {variant === "compact" && (
        <button
          type="button"
          onClick={open}
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors border border-transparent hover:border-border/60",
            className
          )}
          aria-label="Pencarian Pintar"
        >
          <Search className="w-4 h-4 text-primary" />
        </button>
      )}

      {variant === "card" && (
        <div
          role="button"
          tabIndex={0}
          onClick={open}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              open();
            }
          }}
          className={cn(
            "flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-card border border-border/80 shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group",
            className
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                Pencarian Pintar Lingkungan
              </p>
              <p className="text-xs text-muted-foreground">
                Cari warga, nomor rumah, pengumuman, agenda acara, toko UMKM, atau inventaris
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <kbd className="px-2 py-1 rounded-md bg-muted border border-border text-xs font-mono text-muted-foreground">
              ⌘K
            </kbd>
          </div>
        </div>
      )}

      {/* The Dialog */}
      <SmartSearchDialog open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
