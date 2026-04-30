import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { authService } from "@/services/authService";
import { supabase } from "@/integrations/supabase/client";

export function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setName(data?.display_name ?? user.email?.split("@")[0] ?? "");
      });
  }, [user]);

  async function logout() {
    await authService.signOut();
    navigate({ to: "/login" });
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-white/40 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.05)] px-3 md:px-6">
      <div className="flex items-center gap-2">
        <span className="text-xl md:text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-indigo-600 to-cyan-500 drop-shadow-sm">
          Ace It Up
        </span>
      </div>

      <div className="flex items-center gap-1.5 md:gap-2 ml-auto">
        {user && (
          <>
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-secondary text-xs">
              <div className="w-6 h-6 rounded-full bg-gradient-primary grid place-items-center text-[10px] font-bold text-primary-foreground shrink-0">
                {(name || user.email || "U").slice(0, 1).toUpperCase()}
              </div>
              <span className="hidden md:block max-w-[140px] truncate">{name || user.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="px-2 md:px-3">
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline ml-1">Logout</span>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
