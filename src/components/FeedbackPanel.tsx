import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { FeedbackResult } from "@/services/feedbackService";
import { Sparkles, AlertCircle, CheckCircle2, Lightbulb, Cpu, Wrench, Wand2 } from "lucide-react";

export function FeedbackPanel({ feedback, loading, emptyHint }: { feedback: FeedbackResult | null; loading?: boolean; emptyHint: string }) {
  return (
    <Card className="shadow-card bg-card/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent" /> AI Feedback</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Sparkles className="w-10 h-10 mx-auto mb-3 animate-pulse text-accent" />
            Analyzing your answer with AI…
          </div>
        ) : !feedback ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-40" />
            {emptyHint}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="text-center py-4 rounded-xl bg-gradient-hero border border-border">
              <p className="text-5xl font-extrabold text-gradient">{feedback.score}</p>
              <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                {feedback.source === "ai" ? <><Cpu className="w-3 h-3" /> AI evaluation</> : <><Wrench className="w-3 h-3" /> Rule-based fallback</>}
                {" · "}{feedback.wordCount} words
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
              <Metric label="Grammar" value={feedback.grammar_score} />
              <Metric label="Clarity" value={feedback.clarity_score} />
              <Metric label="Confidence" value={feedback.confidence_score} />
            </div>

            <Section icon={CheckCircle2} title="Strengths" tone="accent" items={feedback.strengths} />
            <Section icon={AlertCircle} title="Weaknesses" tone="destructive" items={feedback.weaknesses} />
            <Section icon={Lightbulb} title="Suggestions" tone="primary" items={feedback.suggestions} />

            {feedback.improved_answer && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 tracking-wider inline-flex items-center gap-1">
                  <Wand2 className="w-3 h-3" /> Suggested improved answer
                </p>
                <div className="text-sm leading-relaxed p-3 rounded-lg border border-border bg-secondary/40 whitespace-pre-wrap">
                  {feedback.improved_answer}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3 bg-secondary/30">
      <p className="text-[11px] uppercase text-muted-foreground tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-0.5">{value}</p>
      <Progress value={value} className="h-1 mt-1.5" />
    </div>
  );
}

function Section({ icon: Icon, title, tone, items }: { icon: React.ComponentType<{ className?: string }>; title: string; tone: "accent" | "destructive" | "primary"; items: string[] }) {
  if (!items?.length) return null;
  const colors = {
    accent: "text-accent",
    destructive: "text-destructive",
    primary: "text-primary-foreground",
  } as const;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 tracking-wider">{title}</p>
      <ul className="space-y-2">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${tone === "primary" ? "text-accent" : colors[tone]}`} />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
