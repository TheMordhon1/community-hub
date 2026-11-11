import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CreditCard,
  FileText,
  House,
  LoaderCircle,
  Megaphone,
  MessageSquareText,
  Search,
  Trophy,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { canSearchAllPayments, getUnpaidHouseIds } from "@/lib/search-access";
import { useAuthStore } from "@/stores/authStore";

type SearchCategory = "announcements" | "events" | "schedules" | "residents" | "complaints" | "payments" | "competitions" | "polls" | "contacts" | "stores" | "inventory" | "faq";

interface LibraryResult {
  id: string;
  category: SearchCategory;
  title: string;
  detail: string;
  href: string;
}

interface LibrarySearchBatch {
  results: LibraryResult[];
  failedSources: number;
}

const categoryMeta: Record<SearchCategory, { label: string; icon: LucideIcon }> = {
  announcements: { label: "Pengumuman", icon: Megaphone },
  events: { label: "Acara", icon: CalendarDays },
  schedules: { label: "Jadwal", icon: CalendarDays },
  residents: { label: "Warga & rumah", icon: Users },
  complaints: { label: "Aspirasi", icon: MessageSquareText },
  payments: { label: "Pembayaran IPL", icon: CreditCard },
  competitions: { label: "Kompetisi", icon: Trophy },
  polls: { label: "Jajak pendapat", icon: MessageSquareText },
  contacts: { label: "Kontak penting", icon: Users },
  stores: { label: "Toko warga", icon: House },
  inventory: { label: "Inventaris", icon: FileText },
  faq: { label: "Tanya jawab", icon: FileText },
};

const paymentIntentPattern = /\b(ipl|iuran|pembayaran|bayar|lunas|tunggakan|menunggak|belum|pending|overdue)\b/i;
const unpaidIntentPattern = /\b(belum|tunggakan|menunggak|belum bayar|belum membayar|unpaid|overdue)\b/i;
const monthNames = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];

function cleanSnippet(value: string | null | undefined, maxLength = 110): string {
  const plain = (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return plain.length > maxLength ? `${plain.slice(0, maxLength).trim()}…` : plain;
}

function uniqueResults(results: LibraryResult[]): LibraryResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.category}:${result.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findMonth(query: string): number | null {
  const normalized = query.toLocaleLowerCase("id-ID");
  const index = monthNames.findIndex((month) => new RegExp(`\\b${month}\\b`, "i").test(normalized));
  if (index >= 0) return index + 1;
  const numeric = normalized.match(/\b(?:bulan|month)\s*(1[0-2]|0?[1-9])\b/);
  return numeric ? Number(numeric[1]) : null;
}

function findHouseCode(query: string): string | null {
  const normalized = query.toLocaleLowerCase("id-ID");
  const match = normalized.match(/(?:rumah|blok)\s*([a-z]{1,4})\s*[- ]?\s*(\d{1,4})/i)
    ?? normalized.match(/\b([a-z]{1,4})\s*[- ]?\s*(\d{1,4})\b/i);
  if (!match || /^20\d{2}$/.test(match[2])) return null;
  return `${match[1]}${match[2]}`.replace(/[^a-z0-9]/gi, "").toLocaleLowerCase("id-ID");
}

function paymentStatusLabel(status: string | null): string {
  if (status === "paid") return "Lunas";
  if (status === "overdue") return "Belum dibayar";
  return "Menunggu verifikasi";
}

export function GlobalLibrarySearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const pengurusTitle = useAuthStore((state) => state.pengurusTitle);
  const hasFinanceAccess = useAuthStore((state) => state.hasFinanceAccess);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const userId = user?.id ?? null;
  const canSearchAll = canSearchAllPayments(role, pengurusTitle, hasFinanceAccess);
  const roleReady = role !== null;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    return () => {
      void queryClient.cancelQueries({ queryKey: ["library-search"] });
      queryClient.removeQueries({ queryKey: ["library-search"] });
    };
  }, [queryClient, userId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const searchEnabled = open && !!userId && roleReady && debouncedQuery.length >= 2;

  const { data: directory, isLoading: directoryLoading } = useQuery({
    queryKey: ["library-search", "directory", userId],
    enabled: open && !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const [housesResponse, membersResponse] = await Promise.all([
        supabase.from("houses").select("id,block,number").order("block").order("number").limit(2000),
        supabase.from("house_members").select("id,full_name,house_id").eq("status", "approved").limit(5000),
      ]);
      if (housesResponse.error) throw housesResponse.error;
      if (membersResponse.error) throw membersResponse.error;
      return { houses: housesResponse.data ?? [], members: membersResponse.data ?? [] };
    },
  });

  const { data: paymentRows, isLoading: paymentsLoading } = useQuery({
    queryKey: ["library-search", "payments", userId, canSearchAll, debouncedQuery],
    enabled: searchEnabled && paymentIntentPattern.test(debouncedQuery),
    staleTime: 60_000,
    queryFn: async () => {
      let houseIds: string[] | null = null;
      if (!canSearchAll) {
        if (!userId) return [];
        const { data: memberships, error: membershipsError } = await supabase
          .from("house_members")
          .select("house_id")
          .eq("user_id", userId);
        if (membershipsError) throw membershipsError;
        houseIds = [...new Set((memberships ?? []).map((membership) => membership.house_id))];
        if (houseIds.length === 0) return { rows: [], houseIds };
      }

      let request = supabase
        .from("payments")
        .select("id,house_id,month,year,status,houses!payments_house_id_fkey(block,number)")
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(2000);
      const month = findMonth(debouncedQuery) ?? new Date().getMonth() + 1;
      const year = Number(debouncedQuery.match(/\b20\d{2}\b/)?.[0]) || new Date().getFullYear();
      if (unpaidIntentPattern.test(debouncedQuery)) {
        request = request.eq("month", month).eq("year", year);
      }
      if (houseIds) request = request.in("house_id", houseIds);
      const { data, error } = await request;
      if (error) throw error;
      return { rows: data ?? [], houseIds };
    },
  });

  const { data: searchBatch, isFetching: isSearching } = useQuery({
    queryKey: ["library-search", "text", userId, role, pengurusTitle, hasFinanceAccess, debouncedQuery],
    enabled: searchEnabled,
    staleTime: 30_000,
    queryFn: async (): Promise<LibrarySearchBatch> => {
      if (!userId) return { results: [], failedSources: 0 };
      const pattern = `%${debouncedQuery.replace(/[\\%_]/g, "\\$&")}%`;
      const tasks: Array<{ category: SearchCategory; run: () => Promise<LibraryResult[]> }> = [
        {
          category: "announcements",
          run: async () => {
            const [titles, contents, categories] = await Promise.all([
              supabase.from("announcements").select("id,title,content,category").eq("is_published", true).ilike("title", pattern).limit(8),
              supabase.from("announcements").select("id,title,content,category").eq("is_published", true).ilike("content", pattern).limit(8),
              supabase.from("announcements").select("id,title,content,category").eq("is_published", true).ilike("category", pattern).limit(8),
            ]);
            for (const response of [titles, contents, categories]) if (response.error) throw response.error;
            return uniqueResults([...titles.data ?? [], ...contents.data ?? [], ...categories.data ?? []].map((item) => ({
              id: item.id, category: "announcements", title: item.title,
              detail: [item.category, cleanSnippet(item.content)].filter(Boolean).join(" · "), href: `/announcements/${item.id}`,
            })));
          },
        },
        {
          category: "events",
          run: async () => {
            const [titles, descriptions, locations] = await Promise.all([
              supabase.from("events").select("id,title,description,location,event_date").eq("status", "public").ilike("title", pattern).limit(8),
              supabase.from("events").select("id,title,description,location,event_date").eq("status", "public").ilike("description", pattern).limit(8),
              supabase.from("events").select("id,title,description,location,event_date").eq("status", "public").ilike("location", pattern).limit(8),
            ]);
            for (const response of [titles, descriptions, locations]) if (response.error) throw response.error;
            return uniqueResults([...titles.data ?? [], ...descriptions.data ?? [], ...locations.data ?? []].map((item) => ({
              id: item.id, category: "events", title: item.title,
              detail: [item.event_date, item.location, cleanSnippet(item.description, 70)].filter(Boolean).join(" · "), href: `/events/${item.id}`,
            })));
          },
        },
        {
          category: "schedules",
          run: async () => {
            const [titles, descriptions, locations] = await Promise.all([
              supabase.from("schedules").select("id,title,description,location,start_date,start_time").ilike("title", pattern).limit(8),
              supabase.from("schedules").select("id,title,description,location,start_date,start_time").ilike("description", pattern).limit(8),
              supabase.from("schedules").select("id,title,description,location,start_date,start_time").ilike("location", pattern).limit(8),
            ]);
            for (const response of [titles, descriptions, locations]) if (response.error) throw response.error;
            return uniqueResults([...titles.data ?? [], ...descriptions.data ?? [], ...locations.data ?? []].map((item) => ({
              id: item.id, category: "schedules", title: item.title,
              detail: [item.start_date, item.start_time, item.location, cleanSnippet(item.description, 70)].filter(Boolean).join(" · "), href: `/schedule/${item.id}`,
            })));
          },
        },
        {
          category: "complaints",
          run: async () => {
            const { data, error } = await supabase.from("complaints")
              .select("id,title,status,created_at")
              .or(`is_public.eq.true,user_id.eq.${userId}`)
              .ilike("title", pattern)
              .order("created_at", { ascending: false }).limit(8);
            if (error) throw error;
            return (data ?? []).map((item) => ({
              id: item.id, category: "complaints", title: item.title,
              detail: `Status: ${item.status ?? "Menunggu"}`, href: "/complaints",
            }));
          },
        },
        {
          category: "competitions",
          run: async () => {
            const [sports, formats] = await Promise.all([
              supabase.from("event_competitions").select("id,sport_name,format,status").ilike("sport_name", pattern).limit(8),
              supabase.from("event_competitions").select("id,sport_name,format,status").ilike("format", pattern).limit(8),
            ]);
            if (sports.error) throw sports.error;
            if (formats.error) throw formats.error;
            return uniqueResults([...sports.data ?? [], ...formats.data ?? []].map((item) => ({
              id: item.id, category: "competitions", title: item.sport_name,
              detail: [item.format, item.status].filter(Boolean).join(" · "), href: `/competitions/${item.id}`,
            })));
          },
        },
        {
          category: "polls",
          run: async () => {
            const [titles, descriptions] = await Promise.all([
              supabase.from("polls").select("id,title,description,ends_at").eq("is_active", true).ilike("title", pattern).limit(8),
              supabase.from("polls").select("id,title,description,ends_at").eq("is_active", true).ilike("description", pattern).limit(8),
            ]);
            if (titles.error) throw titles.error;
            if (descriptions.error) throw descriptions.error;
            return uniqueResults([...titles.data ?? [], ...descriptions.data ?? []].map((item) => ({
              id: item.id, category: "polls", title: item.title,
              detail: cleanSnippet(item.description), href: `/polls/${item.id}`,
            })));
          },
        },
        {
          category: "contacts",
          run: async () => {
            const [names, descriptions, platforms] = await Promise.all([
              supabase.from("emergency_contacts").select("id,name,phone,platform,description").eq("is_active", true).ilike("name", pattern).limit(8),
              supabase.from("emergency_contacts").select("id,name,phone,platform,description").eq("is_active", true).ilike("description", pattern).limit(8),
              supabase.from("emergency_contacts").select("id,name,phone,platform,description").eq("is_active", true).ilike("platform", pattern).limit(8),
            ]);
            for (const response of [names, descriptions, platforms]) if (response.error) throw response.error;
            return uniqueResults([...names.data ?? [], ...descriptions.data ?? [], ...platforms.data ?? []].map((item) => ({
              id: item.id, category: "contacts", title: item.name,
              detail: [item.phone, item.platform, cleanSnippet(item.description, 70)].filter(Boolean).join(" · "), href: "/contacts",
            })));
          },
        },
        {
          category: "stores",
          run: async () => {
            const [names, descriptions] = await Promise.all([
              supabase.from("stores").select("id,name,description,status").eq("status", "approved").ilike("name", pattern).limit(8),
              supabase.from("stores").select("id,name,description,status").eq("status", "approved").ilike("description", pattern).limit(8),
            ]);
            if (names.error) throw names.error;
            if (descriptions.error) throw descriptions.error;
            return uniqueResults([...names.data ?? [], ...descriptions.data ?? []].map((item) => ({
              id: item.id, category: "stores", title: item.name,
              detail: cleanSnippet(item.description), href: `/stores/${item.id}`,
            })));
          },
        },
        {
          category: "inventory",
          run: async () => {
            const [names, descriptions, categories] = await Promise.all([
              supabase.from("inventory_items").select("id,name,description,category,available_quantity").ilike("name", pattern).limit(8),
              supabase.from("inventory_items").select("id,name,description,category,available_quantity").ilike("description", pattern).limit(8),
              supabase.from("inventory_items").select("id,name,description,category,available_quantity").ilike("category", pattern).limit(8),
            ]);
            for (const response of [names, descriptions, categories]) if (response.error) throw response.error;
            return uniqueResults([...names.data ?? [], ...descriptions.data ?? [], ...categories.data ?? []].map((item) => ({
              id: item.id, category: "inventory", title: item.name,
              detail: [item.category, `Tersedia: ${item.available_quantity}`, cleanSnippet(item.description, 70)].filter(Boolean).join(" · "), href: "/inventory",
            })));
          },
        },
        {
          category: "faq",
          run: async () => {
            const [questions, answers] = await Promise.all([
              supabase.from("faqs").select("id,question,answer").eq("is_published", true).ilike("question", pattern).limit(8),
              supabase.from("faqs").select("id,question,answer").eq("is_published", true).ilike("answer", pattern).limit(8),
            ]);
            if (questions.error) throw questions.error;
            if (answers.error) throw answers.error;
            return uniqueResults([...questions.data ?? [], ...answers.data ?? []].map((item) => ({
              id: item.id, category: "faq", title: item.question,
              detail: cleanSnippet(item.answer), href: "/dashboard",
            })));
          },
        },
      ];

      const settled = await Promise.allSettled(tasks.map((task) => task.run()));
      const results = settled.flatMap((response) => response.status === "fulfilled" ? response.value : []);
      const failedSources = settled.filter((response) => response.status === "rejected").length;
      return { results, failedSources };
    },
  });

  const directoryResults = useMemo<LibraryResult[]>(() => {
    if (!directory || debouncedQuery.length < 2) return [];
    const normalized = debouncedQuery.toLocaleLowerCase("id-ID").replace(/[^a-z0-9]/g, "");
    const houseCode = findHouseCode(debouncedQuery);
    const housesById = new Map(directory.houses.map((house) => [house.id, house]));
    const matchedHouses = directory.houses.filter((house) => {
      const label = `${house.block}${house.number}`.toLocaleLowerCase("id-ID").replace(/[^a-z0-9]/g, "");
      return houseCode ? label === houseCode : label.includes(normalized);
    });
    const matchedHouseIds = new Set(matchedHouses.map((house) => house.id));
    const matchedMembers = directory.members.filter((member) => {
      const memberName = member.full_name.toLocaleLowerCase("id-ID");
      return (houseCode && matchedHouseIds.has(member.house_id)) || memberName.includes(debouncedQuery.toLocaleLowerCase("id-ID"));
    });
    const houseResults: LibraryResult[] = matchedHouses.map((house) => ({
      id: house.id, category: "residents", title: `Rumah ${house.block}${house.number}`,
      detail: directory.members.filter((member) => member.house_id === house.id).map((member) => member.full_name).slice(0, 4).join(", ") || "Belum ada warga terdaftar",
      href: "/residents",
    }));
    const residentResults: LibraryResult[] = matchedMembers.map((member) => {
      const house = housesById.get(member.house_id);
      return {
        id: member.id, category: "residents", title: member.full_name,
        detail: house ? `Rumah ${house.block}${house.number}` : "Warga terdaftar", href: "/residents",
      };
    });
    return uniqueResults([...houseResults, ...residentResults]).slice(0, 12);
  }, [directory, debouncedQuery]);

  const paymentResults = useMemo<LibraryResult[]>(() => {
    if (!paymentIntentPattern.test(debouncedQuery) || !paymentRows) return [];
    const rows = paymentRows.rows;
    const month = findMonth(debouncedQuery);
    const year = Number(debouncedQuery.match(/\b20\d{2}\b/)?.[0]) || null;
    const houseCode = findHouseCode(debouncedQuery);
    const wantsUnpaid = unpaidIntentPattern.test(debouncedQuery);
    const periodMonth = month ?? new Date().getMonth() + 1;
    const periodYear = year ?? new Date().getFullYear();
    const relevantRows = rows.filter((payment) => {
      if (month && payment.month !== month) return false;
      if (year && payment.year !== year) return false;
      if (wantsUnpaid && payment.status === "paid") return false;
      if (wantsUnpaid && payment.status === "pending") return false;
      const house = payment.houses as { block: string; number: string } | null;
      if (houseCode && (!house || `${house.block}${house.number}`.toLocaleLowerCase("id-ID") !== houseCode)) return false;
      return true;
    });
    const mappedPayments: LibraryResult[] = relevantRows.slice(0, 12).map((payment) => {
      const house = payment.houses as { block: string; number: string } | null;
      const monthName = monthNames[payment.month - 1] ?? `Bulan ${payment.month}`;
      const houseLabel = house ? `Rumah ${house.block}${house.number}` : "Rumah";
      return {
        id: payment.id, category: "payments", title: `IPL ${monthName} ${payment.year} · ${houseLabel}`,
        detail: paymentStatusLabel(payment.status), href: `/payments/${payment.id}`,
      };
    });
    if (!wantsUnpaid || !directory) return mappedPayments;

    const houseIdsInScope = directory.houses
      .filter((house) => canSearchAll || (paymentRows.houseIds ?? []).includes(house.id))
      .filter((house) => {
        if (!houseCode) return true;
        return `${house.block}${house.number}`.toLocaleLowerCase("id-ID") === houseCode;
      })
      .map((house) => house.id);
    const unpaidIds = getUnpaidHouseIds(houseIdsInScope, rows
      .filter((payment) => payment.month === periodMonth && payment.year === periodYear)
      .map((payment) => ({ house_id: payment.house_id, status: payment.status })));
    const housesById = new Map(directory.houses.map((house) => [house.id, house]));
    const missingPayments = unpaidIds.flatMap((houseId) => {
      const hasOverdueRow = rows.some((payment) => payment.house_id === houseId && payment.month === periodMonth && payment.year === periodYear && payment.status === "overdue");
      if (hasOverdueRow) return [];
      const house = housesById.get(houseId);
      if (!house) return [];
      return [{
        id: `unpaid-${house.id}-${periodYear}-${periodMonth}`,
        category: "payments" as const,
        title: `IPL ${monthNames[periodMonth - 1]} ${periodYear} · Rumah ${house.block}${house.number}`,
        detail: "Belum ada pembayaran tercatat",
        href: "/payments",
      }];
    });
    return [...mappedPayments, ...missingPayments].slice(0, 12);
  }, [canSearchAll, debouncedQuery, directory, paymentRows]);

  const visibleResults = useMemo(() => uniqueResults([
    ...directoryResults,
    ...(searchBatch?.results ?? []),
    ...paymentResults,
  ]), [directoryResults, paymentResults, searchBatch]);

  const groupedResults = useMemo(() => {
    const categories = Object.keys(categoryMeta) as SearchCategory[];
    return categories.map((category) => ({
      category,
      ...categoryMeta[category],
      items: visibleResults.filter((item) => item.category === category),
    })).filter((group) => group.items.length > 0);
  }, [visibleResults]);

  const isLoading = (searchEnabled && isSearching) || (searchEnabled && directoryLoading) || (searchEnabled && paymentIntentPattern.test(debouncedQuery) && paymentsLoading);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setDebouncedQuery("");
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="h-9 gap-2 px-3" onClick={() => setOpen(true)} aria-label="Buka pustaka pencarian">
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Cari pustaka</span>
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-2xl overflow-hidden p-0">
          <DialogTitle className="sr-only">Pustaka informasi warga</DialogTitle>
          <Command shouldFilter={false} className="rounded-xl">
            <CommandInput autoFocus value={query} onValueChange={setQuery} placeholder="Cari warga, rumah, acara, IPL…" />
            <CommandList className="max-h-[min(65vh,520px)] p-2">
              {query.trim().length >= 2 && isLoading && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Memuat hasil
                </div>
              )}
              {query.trim().length >= 2 && !isLoading && visibleResults.length === 0 && (
                <CommandEmpty className="py-8 text-sm text-muted-foreground">
                  {searchBatch?.failedSources ? "Sebagian sumber informasi tidak dapat dimuat." : "Tidak ada hasil yang cocok."}
                </CommandEmpty>
              )}
              {groupedResults.map((group) => (
                <CommandGroup key={group.category} heading={group.label}>
                  {group.items.map((item) => {
                    const Icon = group.icon;
                    return (
                      <CommandItem
                        key={`${item.category}:${item.id}`}
                        value={`${item.title} ${item.detail}`}
                        onSelect={() => {
                          handleOpenChange(false);
                          navigate(item.href);
                        }}
                        className="gap-3 py-3"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          {item.category === "residents" ? <House className="h-4 w-4" /> : item.category === "complaints" ? <FileText className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{item.title}</span>
                          {item.detail && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.detail}</span>}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
              {searchBatch?.failedSources ? (
                <p className="px-3 py-2 text-xs text-muted-foreground" role="status">Sebagian sumber informasi tidak dapat dimuat.</p>
              ) : null}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}