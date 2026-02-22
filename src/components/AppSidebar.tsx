import { Link, useLocation } from "react-router-dom";
import { User, LogOut, Database } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS, PENGURUS_TITLE_LABELS } from "@/types/database";
import {
  useSidebarAdminMenus,
  usePengurusMenus,
  useSidebarMainMenus,
} from "@/hooks/useMenus";
import { DynamicIcon } from "@/components/DynamicIcon";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useUpcomingEventsCount } from "@/hooks/useUpcomingEventsCount";
import { useAnnouncementCount } from "@/hooks/useAnnouncementCount";
import { getInitials } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Crown } from "lucide-react";

export function AppSidebar() {
  const location = useLocation();
  const { profile, role, pengurusTitle, signOut, isAdmin, canManageContent } =
    useAuth();
  const { toggleSidebar, isMobile } = useSidebar();

  const { data: mainMenus, isLoading: mainLoading } = useSidebarMainMenus();
  const { data: pengurusMenus, isLoading: pengurusLoading } =
    usePengurusMenus();
  const { data: adminMenus, isLoading: adminLoading } = useSidebarAdminMenus();
  const { data: announcementsCount = 0 } = useAnnouncementCount();
  const { data: upcomingCount = 0 } = useUpcomingEventsCount();

  const { data: isHead = false } = useQuery({
    queryKey: ["is-kk", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return false;
      const { data, error } = await supabase
        .from("house_members")
        .select("is_head")
        .eq("user_id", profile.id)
        .maybeSingle();
      if (error) return false;
      return !!data?.is_head;
    },
    enabled: !!profile?.id,
  });

  const isActive = (path: string) => location.pathname === path;

  const getRoleDisplay = () => {
    if (!role) return "User";
    if (role === "pengurus" && pengurusTitle) {
      return PENGURUS_TITLE_LABELS[pengurusTitle];
    }
    return ROLE_LABELS[role];
  };

  const closeSidebarOnMobile = () => {
    if (isMobile) {
      toggleSidebar();
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden">
            <img src="./logo-pkt.png" className="w-10 h-10" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-lg">Warga PKT</span>
            <span className="text-xs text-sidebar-foreground/70">
              Pesona Kenari Townhouse
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Utama</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainLoading ? (
                <MenuSkeleton />
              ) : (
                mainMenus?.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      onClick={closeSidebarOnMobile}
                    >
                      <Link to={item.url}>
                        <DynamicIcon name={item.icon} className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.title === "Acara" && upcomingCount > 0 && (
                      <SidebarMenuBadge className="w-4 h-4 bg-white/30">
                        {upcomingCount}
                      </SidebarMenuBadge>
                    )}
                    {item.title === "Pengumuman" && announcementsCount > 0 && (
                      <SidebarMenuBadge className="w-4 h-4 bg-white/30">
                        {announcementsCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {canManageContent() && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Menu Pengurus</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {pengurusLoading ? (
                    <MenuSkeleton count={2} />
                  ) : (
                    pengurusMenus?.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.url)}
                          onClick={closeSidebarOnMobile}
                        >
                          <Link to={item.url}>
                            <DynamicIcon name={item.icon} className="w-4 h-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {isAdmin() && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="text-destructive/80">
                Menu Admin
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminLoading ? (
                    <MenuSkeleton count={3} />
                  ) : (
                    adminMenus?.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.url)}
                          onClick={closeSidebarOnMobile}
                        >
                          <Link to={item.url}>
                            <DynamicIcon name={item.icon} className="w-4 h-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  )}
                  {/* Hardcoded Maintenance Link for Admin */}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/admin/maintenance")}
                      onClick={closeSidebarOnMobile}
                    >
                      <Link to="/admin/maintenance">
                        <Database className="w-4 h-4 text-primary" />
                        <span>Pemeliharaan</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-9 h-9">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
            ) : (
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-sm">
                {getInitials(profile?.full_name)}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-sm font-medium line-clamp-1">
                {profile?.full_name ?? "User"}
              </p>
              {isHead && (
                <Badge variant="secondary" className="px-2 h-5 text-[9px] bg-amber-500/10 text-amber-600 border-amber-200/50 font-bold uppercase tracking-wider shadow-sm ring-1 ring-amber-500/20">
                  <Crown className="w-2.5 h-2.5 mr-1" />
                  KK
                </Badge>
              )}
            </div>
            <p className="text-xs text-sidebar-foreground/70 line-clamp-1">
              {getRoleDisplay()}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            asChild
            onClick={closeSidebarOnMobile}
          >
            <Link to="/profile">
              <User className="w-4 h-4 mr-2" />
              Profil
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function MenuSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SidebarMenuItem key={i}>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="w-24 h-4 rounded" />
          </div>
        </SidebarMenuItem>
      ))}
    </>
  );
}
