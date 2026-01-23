import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Kanban, 
  Calendar, 
  MessageCircle, 
  MoreHorizontal,
  User,
  Target,
  Lightbulb,
  FileText,
  FolderOpen,
  Users,
  Award,
  X
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const mainTabs = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Pipeline", href: "/pipeline", icon: Kanban },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Coach", href: "/coach", icon: MessageCircle },
];

const moreItems = [
  { name: "Profile", href: "/profile", icon: User },
  { name: "Topics", href: "/topics", icon: Target },
  { name: "Intelligence", href: "/intelligence", icon: Lightbulb },
  { name: "Templates", href: "/templates", icon: FileText },
  { name: "Assets", href: "/assets", icon: FolderOpen },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Revenue", href: "/revenue", icon: Award },
];

export function MobileBottomNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  
  const isActive = (href: string) => location.pathname === href;
  const isMoreActive = moreItems.some(item => isActive(item.href));

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-pb">
        <div className="flex items-center justify-around h-16">
          {mainTabs.map((tab) => (
            <Link
              key={tab.name}
              to={tab.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                isActive(tab.href)
                  ? "text-violet-600"
                  : "text-muted-foreground"
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{tab.name}</span>
            </Link>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
              isMoreActive || moreOpen
                ? "text-violet-600"
                : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* More Menu Sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[60vh] rounded-t-xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center justify-between">
              More Options
              <button 
                onClick={() => setMoreOpen(false)}
                className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-4 pb-safe">
            {moreItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-xl transition-colors",
                  isActive(item.href)
                    ? "bg-violet-100 text-violet-600 dark:bg-violet-950"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-6 w-6 mb-2" />
                <span className="text-xs font-medium text-center">{item.name}</span>
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
