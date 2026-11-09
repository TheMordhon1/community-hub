import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DynamicIcon } from "@/components/DynamicIcon";
import {
  useSmartSearchData,
  useSmartSearchFilter,
  useRecentSearches,
  SEARCH_CATEGORIES,
  SearchCategory,
  SearchResultItem,
} from "@/hooks/useSmartSearch";
import {
  Search,
  Sparkles,
  ArrowRight,
  Clock,
  Trash2,
  CornerDownLeft,
  Loader2,
  Compass,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SmartSearchDialog({ open, onOpenChange }: SmartSearchDialogProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: allItems = [], isLoading } = useSmartSearchData();
  const { results, totalCount, hasQuery } = useSmartSearchFilter(
    allItems,
    query,
    selectedCategory
  );
  const { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } =
    useRecentSearches();

  // Reset category and query when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedCategory("all");
    }
  }, [open]);

  const handleSelect = (item: SearchResultItem) => {
    if (query.trim()) {
      addRecentSearch(query.trim());
    }
    onOpenChange(false);

    if (item.url.startsWith("tel:")) {
      window.location.href = item.url;
    } else {
      navigate(item.url);
    }
  };

  const handleSelectRecent = (term: string) => {
    setQuery(term);
  };

  // Group results by category for clearer scanning
  const groupedResults = results.reduce<Record<string, SearchResultItem[]>>((acc, item) => {
    const key = item.categoryLabel;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  // Popular quick menus when input is empty
  const popularMenus: SearchResultItem[] = [
    {
      id: "quick-dashboard",
      category: "menu",
      categoryLabel: "Akses Cepat",
      title: "Dashboard",
      subtitle: "Ringkasan informasi & statistik utama",
      url: "/dashboard",
      iconName: "Home",
      badge: "Utama",
      keywords: ["dashboard", "home", "beranda"],
    },
    {
      id: "quick-residents",
      category: "resident",
      categoryLabel: "Akses Cepat",
      title: "Data Warga & Rumah",
      subtitle: "Daftar penghuni blok & nomor rumah",
      url: "/residents",
      iconName: "Users",
      badge: "Warga",
      keywords: ["warga", "rumah", "penghuni"],
    },
    {
      id: "quick-announcements",
      category: "announcement",
      categoryLabel: "Akses Cepat",
      title: "Pengumuman Warga",
      subtitle: "Kabar dan warta terkini paguyuban",
      url: "/announcements",
      iconName: "Megaphone",
      badge: "Warta",
      keywords: ["pengumuman", "warta"],
    },
    {
      id: "quick-events",
      category: "event",
      categoryLabel: "Akses Cepat",
      title: "Acara & Kegiatan",
      subtitle: "Agenda kegiatan, rapat, & kompetisi",
      url: "/events",
      iconName: "Calendar",
      badge: "Agenda",
      keywords: ["acara", "agenda"],
    },
    {
      id: "quick-stores",
      category: "store",
      categoryLabel: "Akses Cepat",
      title: "Toko UMKM Warga",
      subtitle: "Produk & jasa usaha warga perumahan",
      url: "/stores",
      iconName: "Store",
      badge: "UMKM",
      keywords: ["toko", "umkm", "warung"],
    },
    {
      id: "quick-inventory",
      category: "inventory",
      categoryLabel: "Akses Cepat",
      title: "Peminjaman Inventaris",
      subtitle: "Pinjam peralatan paguyuban (tenda, kursi, sound)",
      url: "/inventory",
      iconName: "Package",
      badge: "Fasilitas",
      keywords: ["inventaris", "pinjam", "barang"],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 max-w-2xl overflow-hidden rounded-2xl shadow-2xl border-border/80 bg-background"
        hideCloseButton
      >
        <DialogTitle className="sr-only">Pencarian Pintar Warga PKT</DialogTitle>

        <Command
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-border/60"
          shouldFilter={false} // We do custom scoring and multi-keyword filtering in hook
        >
          {/* Search Header */}
          <div className="relative flex items-center px-4 py-2 border-b border-border/60 bg-muted/20">
            <Search className="w-5 h-5 text-primary shrink-0 mr-3 animate-pulse" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari warga, acara, pengumuman, toko, barang..."
              className="w-full bg-transparent text-sm md:text-base outline-none placeholder:text-muted-foreground py-2 text-foreground font-medium"
              autoFocus
            />
            {query ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => setQuery("")}
              >
                <X className="w-4 h-4" />
              </Button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground border border-border/60 shrink-0">
                ESC
              </kbd>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/40 overflow-x-auto no-scrollbar bg-card/60 backdrop-blur-sm">
            {SEARCH_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border/50"
                  )}
                >
                  <DynamicIcon name={cat.iconName} className="w-3 h-3" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Results List */}
          <CommandList className="max-h-[380px] overflow-y-auto p-2 scroll-smooth">
            {isLoading && (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs">Memuat data pencarian...</span>
              </div>
            )}

            {!isLoading && !hasQuery && (
              <>
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div className="mb-4 px-2">
                    <div className="flex items-center justify-between py-1 mb-1">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pencarian Terakhir
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearRecentSearches}
                        className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-destructive"
                      >
                        Hapus Semua
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recentSearches.map((term, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1 bg-muted/70 hover:bg-muted text-foreground text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer group border border-border/50"
                          onClick={() => handleSelectRecent(term)}
                        >
                          <Clock className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                          <span>{term}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRecentSearch(term);
                            }}
                            className="ml-1 text-muted-foreground/60 hover:text-destructive transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Popular Quick Navigation */}
                <CommandGroup heading="Akses Cepat Populer">
                  {popularMenus.map((item) => (
                    <CommandItem
                      key={item.id}
                      onSelect={() => handleSelect(item)}
                      className="flex items-center justify-between p-2 rounded-xl cursor-pointer hover:bg-accent/80 transition-colors my-0.5 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <DynamicIcon name={item.iconName} className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {item.title}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {item.subtitle}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {item.badge}
                        </Badge>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {!isLoading && hasQuery && results.length === 0 && (
              <CommandEmpty className="py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                  <Search className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Tidak ditemukan hasil untuk "{query}"
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Coba kata kunci lain seperti nama warga, nomor rumah (misal 'A1'), acara, inventaris, atau ubah kategori filter.
                </p>
                <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
                  {["Satpam", "Kerja Bakti", "Tenda", "Warung", "Sembako"].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setQuery(suggestion)}
                      className="text-xs bg-muted/60 hover:bg-muted text-foreground px-2 py-1 rounded border border-border/50 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </CommandEmpty>
            )}

            {!isLoading &&
              hasQuery &&
              Object.entries(groupedResults).map(([groupTitle, groupItems]) => (
                <CommandGroup key={groupTitle} heading={`${groupTitle} (${groupItems.length})`}>
                  {groupItems.map((item) => (
                    <CommandItem
                      key={item.id}
                      onSelect={() => handleSelect(item)}
                      className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-accent/80 transition-colors my-1 group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                        <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <DynamicIcon name={item.iconName} className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground truncate">
                              {item.title}
                            </span>
                            {item.badge && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1.5 py-0 font-normal shrink-0",
                                  item.badgeColor
                                )}
                              >
                                {item.badge}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground truncate">
                            {item.subtitle}
                          </span>
                          {item.description && (
                            <span className="text-[11px] text-muted-foreground/80 line-clamp-1 mt-0.5">
                              {item.description}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 text-muted-foreground/60 group-hover:text-foreground">
                        <CornerDownLeft className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
          </CommandList>

          {/* Footer Shortcuts */}
          <div className="px-4 py-2 border-t border-border/60 bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px] font-mono">↑</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px] font-mono">↓</kbd>
                <span>Navigasi</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px] font-mono">↵</kbd>
                <span>Pilih</span>
              </span>
              <span className="hidden sm:flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px] font-mono">ESC</kbd>
                <span>Tutup</span>
              </span>
            </div>
            {hasQuery && (
              <span className="font-medium text-foreground">
                {totalCount} hasil ditemukan
              </span>
            )}
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
