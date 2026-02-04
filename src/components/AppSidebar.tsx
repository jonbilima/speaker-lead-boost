import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Home,
  Search,
  LayoutGrid,
  Briefcase,
  Calendar,
  LogOut,
  Shield,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const menuItems = [
  { title: "Home", url: "/dashboard", icon: Home },
  { title: "Find", url: "/find", icon: Search },
  { title: "Pipeline", url: "/pipeline", icon: LayoutGrid },
  { title: "Business", url: "/business", icon: Briefcase },
  { title: "Calendar", url: "/calendar", icon: Calendar },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [actionCount, setActionCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  // Fetch action items count and check admin status
  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const today = new Date().toISOString().split("T")[0];
      
      // Count overdue follow-ups
      const { count: overdueCount } = await supabase
        .from("follow_up_reminders")
        .select("*", { count: "exact", head: true })
        .eq("speaker_id", session.user.id)
        .eq("is_completed", false)
        .lt("due_date", today);

      // Count new leads
      const { count: newLeadsCount } = await supabase
        .from("inbound_leads")
        .select("*", { count: "exact", head: true })
        .eq("speaker_id", session.user.id)
        .eq("status", "new");

      const total = (overdueCount || 0) + (newLeadsCount || 0);
      setActionCount(total);

      // Check admin role
      const { data: hasRole } = await supabase.rpc('has_role', {
        _role: 'admin',
        _user_id: session.user.id
      });
      setIsAdmin(!!hasRole);
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out successfully" });
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          {collapsed ? (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">N</span>
            </div>
          ) : (
            <Logo size="sm" />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={`
                      transition-all duration-200
                      hover:bg-sidebar-accent hover:text-sidebar-accent-foreground
                      data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-primary
                      data-[active=true]:font-medium
                    `}
                  >
                    <a href={item.url} onClick={(e) => {
                      e.preventDefault();
                      navigate(item.url);
                    }} className="relative">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.url === "/dashboard" && actionCount > 0 && (
                        <Badge 
                          variant="destructive" 
                          className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
                        >
                          {actionCount}
                        </Badge>
                      )}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Section - Only visible to admins */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/admin")}
                    tooltip="Admin"
                    className="transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-primary data-[active=true]:font-medium"
                  >
                    <a href="/admin" onClick={(e) => {
                      e.preventDefault();
                      navigate("/admin");
                    }}>
                      <Shield className="h-4 w-4" />
                      <span>Admin</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign Out"
              onClick={handleSignOut}
              className="hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
