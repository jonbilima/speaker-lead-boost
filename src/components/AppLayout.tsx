import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { FloatingActionButton } from "@/components/mobile/FloatingActionButton";
import { PWAInstallPrompt } from "@/components/mobile/PWAInstallPrompt";
import { supabase } from "@/integrations/supabase/client";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          navigate("/auth");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Desktop Sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        
        <SidebarInset className="flex-1">
          {/* Desktop Header - hidden on mobile */}
          <header className="hidden md:flex h-14 items-center gap-4 border-b border-border px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          </header>
          
          <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
            {children}
          </main>
        </SidebarInset>
        
        {/* Mobile Components */}
        <MobileBottomNav />
        <FloatingActionButton />
        <PWAInstallPrompt />
      </div>
    </SidebarProvider>
  );
}
