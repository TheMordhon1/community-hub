import { Link, useLocation } from "react-router-dom";
import { User, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS, PENGURUS_TITLE_LABELS } from "@/types/database";
import {
  useSidebarMainMenus,
  useSidebarPengurusMenus,
  useSidebarAdminMenus,
} from "@/hooks/useMenus";
import { DynamicIcon } from "@/components/DynamicIcon";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function AppSidebar() {
  const location = useLocation();
  const { profile, role, pengurusTitle, signOut, isAdmin, canManageContent } =
    useAuth();
  const { toggleSidebar } = useSidebar();

  const { data: mainMenus, isLoading: mainLoading } = useSidebarMainMenus();
  const { data: pengurusMenus, isLoading: pengurusLoading } = useSidebarPengurusMenus();
  const { data: adminMenus, isLoading: adminLoading } = useSidebarAdminMenus();

  const isActive = (path: string) => location.pathname === path;

  const getRoleDisplay = () => {
    if (!role) return "User";
    if (role === "pengurus" && pengurusTitle) {
      return PENGURUS_TITLE_LABELS[pengurusTitle];
    }
    return ROLE_LABELS[role];
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
                      onClick={toggleSidebar}
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
                          onClick={toggleSidebar}
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
                          onClick={toggleSidebar}
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
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-9 h-9">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
            ) : (
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-sm">
                {profile?.full_name?.charAt(0) ?? "U"}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {profile?.full_name ?? "User"}
            </p>
            <p className="text-xs text-sidebar-foreground/70 truncate">
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
            onClick={toggleSidebar}
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

function MenuSkeleton({ count = 4 }: { count?: number }) {
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
