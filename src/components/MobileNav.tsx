import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Brain, Users, Mic, Briefcase } from "lucide-react";

const items = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/modules/aptitude", label: "Aptitude", icon: Brain },
  { to: "/modules/gd", label: "GD", icon: Users },
  { to: "/modules/communication", label: "Comm", icon: Mic },
  { to: "/modules/interview", label: "Interview", icon: Briefcase },
] as const;

export function MobileNav() {
  const { location } = useRouterState();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur safe-area-inset-bottom">
      <ul className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to || location.pathname.startsWith(to + "/");
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${
                  active ? "text-accent" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform ${active ? "scale-110" : ""}`} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
