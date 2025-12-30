import { Link, useLocation } from "react-router-dom";
import {
  Home,
  FileText,
  Calendar,
  MessageSquare,
  Vote,
  User,
  Users,
  Settings,
  CreditCard,
  Map,
  LogOut,
  Building2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS, PENGURUS_TITLE_LABELS } from "@/types/database";
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
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const mainMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Pengumuman", url: "/announcements", icon: FileText },
  { title: "Acara", url: "/events", icon: Calendar },
  { title: "Pengaduan", url: "/complaints", icon: MessageSquare },
  { title: "Polling", url: "/polls", icon: Vote },
  { title: "Peta Rumah", url: "/house-map", icon: Map },
];

const pengurusMenuItems = [
  { title: "Kelola Rumah", url: "/admin/houses", icon: Building2 },
  { title: "Kelola Iuran", url: "/payments", icon: CreditCard },
];

const adminMenuItems = [
  { title: "Kelola Warga", url: "/admin/users", icon: Users },
  { title: "Pengaturan", url: "/admin/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { profile, role, pengurusTitle, signOut, isAdmin, canManageContent } =
    useAuth();

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
          <div className="w-10 h-10 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
            <Home className="w-5 h-5 text-sidebar-primary" />
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
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
                  {pengurusMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <Link to={item.url}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
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
                  {adminMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <Link to={item.url}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
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
