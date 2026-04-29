import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Users, Mic, Briefcase, TrendingUp, Flame, Target, ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { progressService, type Attempt, type ModuleScore, type ModuleKey } from "@/services/progressService";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Ace It Up" }] }),
  component: Dashboard,
});

const MODULES: { key: ModuleKey; label: string; to: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { key: "aptitude", label: "Aptitude", to: "/modules/aptitude", icon: Brain, desc: "Timed MCQ practice" },
  { key: "gd", label: "Group Discussion", to: "/modules/gd", icon: Users, desc: "Topic-based responses" },
  { key: "communication", label: "Communication", to: "/modules/communication", icon: Mic, desc: "Daily speaking prompts" },
  { key: "interview", label: "Interview", to: "/modules/interview", icon: Briefcase, desc: "HR & technical Q&A" },
];

function Dashboard() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [scores, setScores] = useState<ModuleScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [stats, profile] = await Promise.all([
          progressService.getOverallStats(),
          supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
        ]);
        if (cancelled) return;
        setAttempts(stats.attempts);
        setScores(stats.scores);
        setName(profile.data?.display_name ?? user.email?.split("@")[0] ?? "");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const totalAttempts = attempts.length;
  const overallAvg = totalAttempts ? Math.round(attempts.reduce((a, b) => a + b.score, 0) / totalAttempts) : 0;
  const best = totalAttempts ? Math.max(...attempts.map((a) => a.score)) : 0;
  const trend = progressService.weeklyTrend(attempts);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          Hi {name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="text-muted-foreground mt-1">Here's your placement prep snapshot.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={TrendingUp} label="Avg Score" value={loading ? "…" : `${overallAvg}%`} />
        <StatCard icon={Flame} label="Total Attempts" value={loading ? "…" : String(totalAttempts)} />
        <StatCard icon={Target} label="Best Score" value={loading ? "…" : `${best}%`} />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="w-4 h-4 text-accent" /> Weekly trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.62 0.21 275)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.78 0.14 200)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.32 0.03 270)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.03 270)", border: "1px solid oklch(0.32 0.03 270)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="score" stroke="oklch(0.78 0.14 200)" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="font-semibold mb-3">Skill Breakdown</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => {
            const s = scores.find((x) => x.module === m.key);
            const avg = s ? Math.round(Number(s.avg_score)) : 0;
            const count = s?.attempts_count ?? 0;
            return (
              <Link key={m.key} to={m.to} className="group">
                <Card className="h-full shadow-card hover:border-accent/60 hover:-translate-y-1 transition-all duration-200">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="grid place-items-center w-11 h-11 rounded-xl bg-gradient-primary shadow-glow">
                        <m.icon className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <div>
                      <p className="font-semibold">{m.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-gradient-primary" style={{ width: `${avg}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{count} attempts</span>
                      <span className="font-semibold text-accent">{avg}% avg</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Recent Activity</h2>
        <Card className="shadow-card">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                <Sparkles className="w-5 h-5 inline animate-pulse text-accent" /> Loading…
              </div>
            ) : attempts.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No attempts yet. Pick a module above to start practicing!
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {attempts.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium capitalize">{p.module}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{p.detail ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                      <span className="font-bold text-accent w-12 text-right">{p.score}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="grid place-items-center w-11 h-11 rounded-xl bg-secondary">
          <Icon className="w-5 h-5 text-accent" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-extrabold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
