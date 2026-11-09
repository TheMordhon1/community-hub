import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { PanelLeft } from "lucide-react";
import { SmartSearchTrigger } from "@/components/search/SmartSearchTrigger";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-14 border-b border-border/70 flex items-center justify-between px-4 bg-background/85 backdrop-blur-md gap-2">
            <div className="flex items-center shrink-0">
              <SidebarTrigger className="mr-3 rounded-lg">
                <PanelLeft className="h-5 w-5" />
              </SidebarTrigger>
              <span className="font-display font-bold tracking-tight">Warga PKT</span>
            </div>
            <div className="flex items-center">
              <SmartSearchTrigger variant="header" />
            </div>
          </header>
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
