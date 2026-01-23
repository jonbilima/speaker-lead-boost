import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Kanban,
  Calendar,
  FolderOpen,
  Lightbulb,
  User,
  LogOut,
  DollarSign,
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
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Pipeline", url: "/pipeline", icon: Kanban },
  { title: "Revenue", url: "/revenue", icon: DollarSign },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Assets", url: "/assets", icon: FolderOpen },
  { title: "Intelligence", url: "/intelligence", icon: Lightbulb },
  { title: "Profile", url: "/profile", icon: User },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [overdueCount, setOverdueCount] = useState(0);

  const isActive = (path: string) => location.pathname === path;

  // Fetch overdue follow-up count
  useEffect(() => {
    const fetchOverdueCount = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const today = new Date().toISOString().split("T")[0];
      const { count, error } = await supabase
        .from("follow_up_reminders")
        .select("*", { count: "exact", head: true })
        .eq("speaker_id", session.user.id)
        .eq("is_completed", false)
        .lt("due_date", today);

      if (!error && count !== null) {
        setOverdueCount(count);
      }
    };

    fetchOverdueCount();
    // Refresh every 60 seconds
    const interval = setInterval(fetchOverdueCount, 60000);
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">N</span>
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
                      hover:bg-violet-100 hover:text-violet-700
                      data-[active=true]:bg-violet-100 data-[active=true]:text-violet-700
                      data-[active=true]:font-medium
                    `}
                  >
                    <a href={item.url} onClick={(e) => {
                      e.preventDefault();
                      navigate(item.url);
                    }} className="relative">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.url === "/pipeline" && overdueCount > 0 && (
                        <Badge 
                          variant="destructive" 
                          className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
                        >
                          {overdueCount}
                        </Badge>
                      )}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign Out"
              onClick={handleSignOut}
              className="hover:bg-red-50 hover:text-red-600 transition-colors"
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
