import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Brain, Users, Mic, Briefcase, Sparkles } from "lucide-react";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/modules/aptitude", label: "Aptitude", icon: Brain },
  { to: "/modules/gd", label: "Group Discussion", icon: Users },
  { to: "/modules/communication", label: "Communication", icon: Mic },
  { to: "/modules/interview", label: "Interview", icon: Briefcase },
] as const;

export function Sidebar() {
  const { location } = useRouterState();

  return (
    <aside className="hidden md:flex flex-col bg-white/40 backdrop-blur-xl transition-all duration-300 ease-in-out w-[4.5rem] hover:w-64 z-40 group shrink-0 h-full overflow-hidden">

      <nav className="flex-1 px-3 py-4 space-y-2">
        {items.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to || location.pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center rounded-xl px-3 py-3 text-sm font-medium transition-all whitespace-nowrap ${
                active
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-semibold">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>


    </aside>
  );
}
