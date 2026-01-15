import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminTitles from "./pages/admin/Titles";
import AdminMenus from "./pages/admin/Menus";
import AdminEmergencyContacts from "./pages/admin/EmergencyContacts";
import LandingSettings from "./pages/admin/LandingSettings";
import Announcements from "./pages/Announcements";
import AnnouncementDetail from "./pages/AnnouncementDetail";
import Events from "./pages/Events";
import EventDetails from "./pages/EventDetails";
import Complaints from "./pages/Complaints";
import Polls from "./pages/Polls";
import PollsDetail from "./pages/PollsDetail";
import Profile from "./pages/Profile";
import Payments from "./pages/Payments";
import PaymentDetail from "./pages/PaymentDetail";
import Finance from "./pages/Finance";
import OrganizationStructure from "./pages/OrganizationStructure";
import Residents from "./pages/Residents";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";
import Houses from "./pages/Houses";
import Home from "./pages/Index";

const queryClient = new QueryClient();

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isInitialized } = useAuth();

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/login"
        element={
          <AuthRedirect>
            <Login />
          </AuthRedirect>
        }
      />
      <Route
        path="/register"
        element={
          <AuthRedirect>
            <Register />
          </AuthRedirect>
        }
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/announcements/:id" element={<AnnouncementDetail />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetails />} />
          <Route path="/complaints" element={<Complaints />} />
          <Route path="/polls" element={<Polls />} />
          <Route path="/polls/:id" element={<PollsDetail />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/payments/:id" element={<PaymentDetail />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/organization" element={<OrganizationStructure />} />
          <Route path="/residents" element={<Residents />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/houses" element={<Houses />} />
          <Route path="/admin/titles" element={<AdminTitles />} />
          <Route path="/admin/menus" element={<AdminMenus />} />
          <Route path="/admin/landing" element={<LandingSettings />} />
          <Route path="/admin/emergency-contacts" element={<AdminEmergencyContacts />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
