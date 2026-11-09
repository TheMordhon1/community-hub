import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MEMBER_TYPE_LABELS, MemberType } from "@/types/database";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export type SearchCategory =
  | "all"
  | "menu"
  | "announcement"
  | "event"
  | "resident"
  | "store"
  | "inventory"
  | "contact"
  | "document";

export interface SearchCategoryMeta {
  id: SearchCategory;
  label: string;
  iconName: string;
  color: string;
}

export const SEARCH_CATEGORIES: SearchCategoryMeta[] = [
  { id: "all", label: "Semua", iconName: "Sparkles", color: "text-primary" },
  { id: "menu", label: "Menu", iconName: "Compass", color: "text-blue-500" },
  { id: "announcement", label: "Pengumuman", iconName: "Megaphone", color: "text-amber-500" },
  { id: "event", label: "Acara", iconName: "Calendar", color: "text-purple-500" },
  { id: "resident", label: "Warga", iconName: "Users", color: "text-emerald-500" },
  { id: "store", label: "Toko UMKM", iconName: "Store", color: "text-orange-500" },
  { id: "inventory", label: "Inventaris", iconName: "Package", color: "text-indigo-500" },
  { id: "contact", label: "Kontak", iconName: "Phone", color: "text-rose-500" },
  { id: "document", label: "Dokumen", iconName: "FileText", color: "text-teal-500" },
];

export interface SearchResultItem {
  id: string;
  category: SearchCategory;
  categoryLabel: string;
  title: string;
  subtitle: string;
  description?: string;
  badge?: string;
  badgeColor?: string;
  url: string;
  iconName: string;
  keywords: string[];
}

const RECENT_SEARCHES_KEY = "warga_pkt_recent_searches";

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {
      // ignore JSON parse errors
    }
  }, []);

  const addRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 6);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
  };

  const removeRecentSearch = (term: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== term);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // ignore storage errors
    }
  };

  return { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches };
}

export function useSmartSearchData() {
  return useQuery({
    queryKey: ["smart-search-all-data"],
    queryFn: async (): Promise<SearchResultItem[]> => {
      const items: SearchResultItem[] = [];

      // Fetch all sources concurrently
      const [
        menusRes,
        announcementsRes,
        eventsRes,
        housesRes,
        membersRes,
        storesRes,
        inventoryRes,
        contactsRes,
        rabRes,
      ] = await Promise.all([
        supabase
          .from("menus")
          .select("id, name, title, url, icon, color, is_active")
          .eq("is_active", true),
        supabase
          .from("announcements")
          .select("id, title, content, category, created_at")
          .eq("is_published", true)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("events")
          .select("id, title, description, location, event_date, category, status")
          .order("event_date", { ascending: false })
          .limit(40),
        supabase.from("houses").select("id, block, number"),
        supabase
          .from("house_members")
          .select("id, full_name, house_id, member_type, is_head")
          .limit(200),
        supabase
          .from("stores")
          .select("id, name, description, categories, phone, status")
          .eq("status", "approved")
          .limit(50),
        supabase
          .from("inventory_items")
          .select("id, name, description, category, quantity, available_quantity")
          .limit(60),
        supabase
          .from("emergency_contacts")
          .select("id, name, phone, description, platform")
          .eq("is_active", true)
          .limit(30),
        supabase
          .from("rab_documents")
          .select("id, title, description, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      // 1. Menus
      if (menusRes.data) {
        menusRes.data.forEach((menu) => {
          items.push({
            id: `menu-${menu.id}`,
            category: "menu",
            categoryLabel: "Menu Aplikasi",
            title: menu.title,
            subtitle: `Navigasi ke ${menu.url}`,
            url: menu.url,
            iconName: menu.icon || "Compass",
            badge: "Navigasi",
            keywords: [menu.name, menu.title, menu.url, "halaman", "menu", "buka"],
          });
        });
      }

      // 2. Announcements
      if (announcementsRes.data) {
        announcementsRes.data.forEach((ann) => {
          const dateStr = ann.created_at
            ? format(new Date(ann.created_at), "dd MMM yyyy", { locale: idLocale })
            : "";
          items.push({
            id: `ann-${ann.id}`,
            category: "announcement",
            categoryLabel: "Pengumuman",
            title: ann.title,
            subtitle: `${dateStr} • ${ann.category || "Informasi"}`,
            description: ann.content.slice(0, 140),
            url: `/announcements/${ann.id}`,
            iconName: "Megaphone",
            badge: ann.category || "Warta",
            badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
            keywords: [ann.title, ann.category || "", ann.content, "pengumuman", "warta", "kabar"],
          });
        });
      }

      // 3. Events
      if (eventsRes.data) {
        eventsRes.data.forEach((ev) => {
          const dateStr = ev.event_date
            ? format(new Date(ev.event_date), "dd MMM yyyy, HH:mm", { locale: idLocale })
            : "";
          items.push({
            id: `event-${ev.id}`,
            category: "event",
            categoryLabel: "Acara & Kegiatan",
            title: ev.title,
            subtitle: `${dateStr}${ev.location ? ` • ${ev.location}` : ""}`,
            description: ev.description?.slice(0, 140),
            url: `/events/${ev.id}`,
            iconName: "Calendar",
            badge: ev.category || "Acara",
            badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20",
            keywords: [ev.title, ev.location || "", ev.description || "", ev.category || "", "acara", "kegiatan", "lomba"],
          });
        });
      }

      // 4. Residents & Houses
      const houseMap = new Map<string, { block: string; number: string }>();
      if (housesRes.data) {
        housesRes.data.forEach((h) => {
          houseMap.set(h.id, { block: h.block, number: h.number });
        });
      }

      if (membersRes.data) {
        membersRes.data.forEach((m) => {
          const house = m.house_id ? houseMap.get(m.house_id) : null;
          const houseText = house ? `Blok ${house.block} No. ${house.number}` : "Rumah Belum Terdaftar";
          const typeLabel = m.member_type
            ? (MEMBER_TYPE_LABELS[m.member_type as MemberType] || m.member_type)
            : m.is_head
            ? "Kepala Keluarga"
            : "Warga";

          items.push({
            id: `resident-${m.id}`,
            category: "resident",
            categoryLabel: "Warga & Rumah",
            title: m.full_name,
            subtitle: `${houseText} • ${typeLabel}`,
            url: `/residents?search=${encodeURIComponent(m.full_name)}`,
            iconName: "Users",
            badge: house ? `${house.block}/${house.number}` : "Warga",
            badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
            keywords: [
              m.full_name,
              house ? house.block : "",
              house ? house.number : "",
              house ? `${house.block}${house.number}` : "",
              house ? `${house.block} ${house.number}` : "",
              houseText,
              typeLabel,
              "warga",
              "penghuni",
              "rumah",
            ],
          });
        });
      }

      // 5. Stores & UMKM
      if (storesRes.data) {
        storesRes.data.forEach((st) => {
          const cats = Array.isArray(st.categories) ? st.categories.join(", ") : "";
          items.push({
            id: `store-${st.id}`,
            category: "store",
            categoryLabel: "Toko UMKM Warga",
            title: st.name,
            subtitle: cats || "UMKM Warga",
            description: st.description?.slice(0, 120),
            url: `/stores/${st.id}`,
            iconName: "Store",
            badge: "UMKM",
            badgeColor: "bg-orange-500/10 text-orange-600 border-orange-500/20",
            keywords: [st.name, cats, st.description || "", st.phone || "", "toko", "warung", "umkm", "jualan", "beli"],
          });
        });
      }

      // 6. Inventory
      if (inventoryRes.data) {
        inventoryRes.data.forEach((inv) => {
          const stockText = `Tersedia ${inv.available_quantity} dari ${inv.quantity}`;
          items.push({
            id: `inv-${inv.id}`,
            category: "inventory",
            categoryLabel: "Inventaris & Fasilitas",
            title: inv.name,
            subtitle: `${inv.category ? `${inv.category} • ` : ""}${stockText}`,
            description: inv.description?.slice(0, 120),
            url: "/inventory",
            iconName: "Package",
            badge: inv.available_quantity > 0 ? "Tersedia" : "Dipinjam",
            badgeColor:
              inv.available_quantity > 0
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-600 border-rose-500/20",
            keywords: [inv.name, inv.category || "", inv.description || "", "inventaris", "pinjam", "fasilitas", "barang"],
          });
        });
      }

      // 7. Emergency Contacts
      if (contactsRes.data) {
        contactsRes.data.forEach((ct) => {
          items.push({
            id: `contact-${ct.id}`,
            category: "contact",
            categoryLabel: "Kontak Penting",
            title: ct.name,
            subtitle: `${ct.phone}${ct.description ? ` • ${ct.description}` : ""}`,
            url: ct.phone ? `tel:${ct.phone}` : "/contacts",
            iconName: "Phone",
            badge: "Darurat",
            badgeColor: "bg-rose-500/10 text-rose-600 border-rose-500/20",
            keywords: [ct.name, ct.phone, ct.description || "", ct.platform || "", "kontak", "darurat", "satpam", "telepon"],
          });
        });
      }

      // 8. RAB Documents
      if (rabRes.data) {
        rabRes.data.forEach((doc) => {
          const dateStr = doc.created_at
            ? format(new Date(doc.created_at), "dd MMM yyyy", { locale: idLocale })
            : "";
          items.push({
            id: `doc-${doc.id}`,
            category: "document",
            categoryLabel: "Dokumen & RAB",
            title: doc.title,
            subtitle: `${dateStr} • Dokumen Anggaran (PDF)`,
            description: doc.description?.slice(0, 120),
            url: "/rab",
            iconName: "FileText",
            badge: "PDF RAB",
            badgeColor: "bg-teal-500/10 text-teal-600 border-teal-500/20",
            keywords: [doc.title, doc.description || "", "rab", "dokumen", "laporan", "anggaran", "pdf"],
          });
        });
      }

      return items;
    },
    staleTime: 1000 * 60 * 3, // Cache 3 minutes
  });
}

export function useSmartSearchFilter(
  items: SearchResultItem[],
  query: string,
  category: SearchCategory
) {
  return useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const terms = trimmed.split(/\s+/).filter(Boolean);

    // Filter by category first if not "all"
    const categoryFiltered =
      category === "all" ? items : items.filter((item) => item.category === category);

    // If no query, return top items in category
    if (terms.length === 0) {
      return {
        results: categoryFiltered.slice(0, 20),
        totalCount: categoryFiltered.length,
        hasQuery: false,
      };
    }

    // Match scoring
    const scored = categoryFiltered
      .map((item) => {
        const titleLower = item.title.toLowerCase();
        const subtitleLower = item.subtitle.toLowerCase();
        const descLower = (item.description || "").toLowerCase();
        const keywordsLower = item.keywords.join(" ").toLowerCase();
        const searchable = `${titleLower} ${subtitleLower} ${descLower} ${keywordsLower}`;

        // Every term must be present somewhere
        const matchesAllTerms = terms.every((term) => searchable.includes(term));
        if (!matchesAllTerms) return null;

        let score = 0;

        // Exact match
        if (titleLower === trimmed) {
          score += 300;
        } else if (titleLower.startsWith(trimmed)) {
          score += 150;
        } else if (titleLower.includes(trimmed)) {
          score += 80;
        }

        // Subtitle / resident house number match
        if (subtitleLower.includes(trimmed)) {
          score += 60;
        }

        // Term specific bonuses
        terms.forEach((term) => {
          if (titleLower.includes(term)) score += 30;
          if (subtitleLower.includes(term)) score += 20;
          if (keywordsLower.includes(term)) score += 10;
        });

        // Boost menus for navigation intent
        if (item.category === "menu" && (titleLower.startsWith(trimmed) || trimmed.length <= 4)) {
          score += 40;
        }

        return { item, score };
      })
      .filter((entry): entry is { item: SearchResultItem; score: number } => entry !== null)
      .sort((a, b) => b.score - a.score);

    return {
      results: scored.map((s) => s.item).slice(0, 30),
      totalCount: scored.length,
      hasQuery: true,
    };
  }, [items, query, category]);
}
