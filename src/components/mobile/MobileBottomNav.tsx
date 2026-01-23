import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  Search, 
  LayoutGrid, 
  Briefcase, 
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Find", href: "/find", icon: Search },
  { name: "Pipeline", href: "/pipeline", icon: LayoutGrid },
  { name: "Business", href: "/business", icon: Briefcase },
  { name: "Calendar", href: "/calendar", icon: Calendar },
];

export function MobileBottomNav() {
  const location = useLocation();
  
  const isActive = (href: string) => location.pathname === href;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
              isActive(item.href)
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs font-medium">{item.name}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
