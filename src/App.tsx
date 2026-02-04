import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GuidedTour } from "@/components/onboarding/GuidedTour";
import { toast } from "sonner";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Pipeline from "./pages/Pipeline";
import CalendarPage from "./pages/CalendarPage";
import Assets from "./pages/Assets";
import Coach from "./pages/Coach";
import Templates from "./pages/Templates";
import Topics from "./pages/Topics";
import Find from "./pages/Find";
import Business from "./pages/Business";
import EmbedWidget from "./pages/EmbedWidget";
import TestimonialSubmit from "./pages/TestimonialSubmit";
import AdminScraping from "./pages/AdminScraping";
import AdminWaitlist from "./pages/AdminWaitlist";
import PackageView from "./pages/PackageView";
import Speeches from "./pages/Speeches";
import Performance from "./pages/Performance";
import FeedbackForm from "./pages/FeedbackForm";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";

// Configure React Query with appropriate cache times
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default stale time of 2 minutes for most data
      staleTime: 2 * 60 * 1000,
      // Cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests once
      retry: 1,
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

// Global unhandled rejection handler component
function GlobalErrorHandler({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      // Prevent the app from crashing on unhandled rejections
      event.preventDefault();
      
      // Only show toast for non-network errors to avoid spamming
      const reason = event.reason?.message || String(event.reason);
      if (!reason.includes("Failed to fetch") && !reason.includes("NetworkError")) {
        toast.error("An unexpected error occurred. Please try again.");
      }
    };

    const handleError = (event: ErrorEvent) => {
      console.error("Unhandled error:", event.error);
      // Prevent crash on specific DOM-related errors
      if (event.message?.includes("nodeName") || event.message?.includes("Cannot read properties of null")) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleError);
    
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <ErrorBoundary>
          <GlobalErrorHandler>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <GuidedTour />
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/assets" element={<Assets />} />
                <Route path="/coach" element={<Coach />} />
                <Route path="/templates" element={<Templates />} />
                <Route path="/topics" element={<Topics />} />
                <Route path="/find" element={<Find />} />
                <Route path="/business" element={<Business />} />
                <Route path="/embed/:slug" element={<EmbedWidget />} />
                <Route path="/testimonial/:token" element={<TestimonialSubmit />} />
                <Route path="/admin/scraping" element={<AdminScraping />} />
                <Route path="/admin/waitlist" element={<AdminWaitlist />} />
                <Route path="/p/:trackingCode" element={<PackageView />} />
                <Route path="/speeches" element={<Speeches />} />
                <Route path="/performance" element={<Performance />} />
                <Route path="/feedback/:token" element={<FeedbackForm />} />
                <Route path="/admin" element={<Admin />} />
                
                {/* Redirects for legacy routes */}
                <Route path="/intelligence" element={<Navigate to="/find" replace />} />
                <Route path="/leads" element={<Navigate to="/business" replace />} />
                <Route path="/revenue" element={<Navigate to="/business" replace />} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </GlobalErrorHandler>
        </ErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
