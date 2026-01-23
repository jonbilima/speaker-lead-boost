import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Pipeline from "./pages/Pipeline";
import CalendarPage from "./pages/CalendarPage";
import Assets from "./pages/Assets";
import Intelligence from "./pages/Intelligence";
import Revenue from "./pages/Revenue";
import AdminScraping from "./pages/AdminScraping";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="/admin/scraping" element={<AdminScraping />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
