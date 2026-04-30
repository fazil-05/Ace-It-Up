import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { moduleService } from "@/services/moduleService";
import { feedbackService, type AptitudeQuestion } from "@/services/feedbackService";
import { progressService } from "@/services/progressService";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Brain, Clock, RotateCcw, Trophy, Loader2, Sparkles, Cpu, Wrench, Mic } from "lucide-react";

const TIME_PER_Q = 60; // seconds per question (soft limit, not enforced)
const QUESTION_COUNT = 5;

export function Aptitude() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<AptitudeQuestion[]>([]);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [source, setSource] = useState<"ai" | "fallback">("fallback");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [perQTime, setPerQTime] = useState<number[]>([]);
  const [time, setTime] = useState(TIME_PER_Q);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const qStartRef = useRef<number>(Date.now());

  const speak = (content: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  // Load adaptive questions on mount.
  useEffect(() => { void loadQuestions(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function loadQuestions() {
    setLoading(true); setDone(false); setIdx(0); setAnswers([]); setPerQTime([]); setTime(TIME_PER_Q);
    try {
      // Pull recent aptitude attempts to compute adaptive difficulty + weak topics.
      let recentAvg: number | null = null;
      let weakTopics: string[] = [];
      if (user) {
        const recent = await moduleService.listModuleAttempts("aptitude", 20);
        if (recent.length) {
          recentAvg = Math.round(recent.reduce((a, b) => a + b.score, 0) / recent.length);
          const byTopic = new Map<string, { sum: number; n: number }>();
          for (const a of recent) {
            if (!a.topic) continue;
            const e = byTopic.get(a.topic) ?? { sum: 0, n: 0 };
            e.sum += a.score; e.n += 1; byTopic.set(a.topic, e);
          }
          weakTopics = [...byTopic.entries()]
            .map(([t, v]) => ({ t, avg: v.sum / v.n }))
            .filter((x) => x.avg < 60)
            .sort((a, b) => a.avg - b.avg)
            .slice(0, 4)
            .map((x) => x.t);
        }
      }
      const res = await feedbackService.getAdaptiveQuestions({ recentAvg, weakTopics, count: QUESTION_COUNT });
      setQuestions(res.questions);
      setDifficulty(res.difficulty as "easy" | "medium" | "hard");
      setSource(res.source as "ai" | "fallback");
      qStartRef.current = Date.now();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load questions");
    } finally {
      setLoading(false);
    }
  }

  // Soft countdown — does not auto-advance, just nudges the user.
  useEffect(() => {
    if (done || loading) return;
    if (time <= 0) return;
    const t = setTimeout(() => setTime((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [time, done, loading]);

  const score = useMemo(
    () => answers.reduce((acc, a, i) => acc + (a === questions[i]?.answer_index ? 1 : 0), 0),
    [answers, questions],
  );

  function pick(opt: number) {
    const elapsed = Date.now() - qStartRef.current;
    const nextAns = [...answers, opt];
    const nextTimes = [...perQTime, elapsed];
    setAnswers(nextAns); setPerQTime(nextTimes);
    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
      setTime(TIME_PER_Q);
      qStartRef.current = Date.now();
    } else {
      void finish(nextAns, nextTimes);
    }
  }

  async function finish(final: number[], times: number[]) {
    if (done || !user) { setDone(true); return; }
    setDone(true);
    setSaving(true);
    try {
      const totalMs = times.reduce((a, b) => a + b, 0);
      // Per-question attempts (so we get per-topic accuracy in analytics).
      await Promise.all(final.map((ans, i) => {
        const q = questions[i];
        if (!q) return Promise.resolve();
        const correct = ans === q.answer_index;
        return moduleService.saveAttempt({
          userId: user.id,
          module: "aptitude",
          score: correct ? 100 : 0,
          detail: `${q.topic} · ${q.difficulty}`,
          prompt: q.question,
          answer: String(q.options[ans] ?? ""),
          feedback: { correct, correct_index: q.answer_index, explanation: q.explanation } as Record<string, unknown>,
          difficulty: q.difficulty,
          topic: q.topic,
          timeSpentMs: times[i] ?? null,
        });
      }));
      // Aggregate session record (avg %) so dashboard list still shows one entry per session too.
      const pct = Math.round((final.reduce((a, ans, i) => a + (ans === questions[i]?.answer_index ? 1 : 0), 0) / questions.length) * 100);
      await moduleService.saveAttempt({
        userId: user.id,
        module: "aptitude",
        score: pct,
        detail: `Session · ${final.length} Qs · ${difficulty}`,
        difficulty,
        topic: "session-summary",
        timeSpentMs: totalMs,
      });
      // Refresh cached progress (no-op if not used).
      void progressService.listAttempts(50);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save attempt");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="w-5 h-5 text-accent" /> Loading adaptive test…</CardTitle></CardHeader>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-accent" />
          Tailoring questions to your level…
        </CardContent>
      </Card>
    );
  }

  if (done) {
    const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
    return (
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-accent" /> Test complete</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => speak(`Test complete. Your score is ${pct} percent. You got ${score} out of ${questions.length} correct.`)} className="h-8 w-8 text-muted-foreground hover:text-accent">
            <Mic className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-6">
            <p className="text-6xl font-extrabold text-gradient">{pct}%</p>
            <p className="text-muted-foreground mt-2">{score} / {questions.length} correct · <span className="capitalize">{difficulty}</span></p>
            <p className="text-xs text-muted-foreground mt-1">{saving ? "Saving…" : "Saved to your progress ✓"}</p>
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {questions.map((q, i) => {
              const correct = answers[i] === q.answer_index;
              return (
                <div key={q.id} className={`p-3 rounded-lg border text-sm ${correct ? "border-accent/40 bg-accent/5" : "border-destructive/40 bg-destructive/5"}`}>
                  <p className="font-medium">{i + 1}. {q.question}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your answer: <span className={correct ? "text-accent" : "text-destructive"}>{q.options[answers[i]] ?? "—"}</span>
                    {!correct && <> · Correct: <span className="text-accent">{q.options[q.answer_index]}</span></>}
                  </p>
                  <div className="flex items-start justify-between gap-2 mt-1">
                    <p className="text-xs">{q.explanation}</p>
                    <Button variant="ghost" size="icon" onClick={() => speak(q.explanation)} className="h-6 w-6 shrink-0 text-muted-foreground hover:text-accent">
                      <Mic className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <Button onClick={loadQuestions} className="w-full bg-gradient-primary border-0">
            <RotateCcw className="w-4 h-4 mr-2" /> Next adaptive set
          </Button>
        </CardContent>
      </Card>
    );
  }

  const cur = questions[idx];
  if (!cur) return null;
  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2"><Brain className="w-5 h-5 text-accent" /> Aptitude</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => speak(cur.question)} className="h-8 w-8 text-muted-foreground hover:text-accent" title="Listen to question">
            <Mic className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">{difficulty}</Badge>
          <Badge variant="outline" className="text-[10px] gap-1">
            {source === "ai" ? <><Cpu className="w-3 h-3" /> AI</> : <><Wrench className="w-3 h-3" /> Bank</>}
          </Badge>
          <div className="flex items-center gap-1.5 text-sm font-mono px-3 py-1 rounded-full bg-secondary">
            <Clock className="w-4 h-4" /> {String(Math.floor(time / 60)).padStart(2, "0")}:{String(time % 60).padStart(2, "0")}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Progress value={(idx / questions.length) * 100} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Question {idx + 1} of {questions.length}</span>
          <span className="inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> Topic: {cur.topic.replace(/-/g, " ")}</span>
        </div>
        <h3 className="text-lg font-semibold leading-snug">{cur.question}</h3>
        <div className="grid gap-2">
          {cur.options.map((o, i) => (
            <button key={i} onClick={() => pick(i)} className="text-left px-4 py-3 rounded-lg border border-border bg-secondary/40 hover:bg-secondary hover:border-accent transition-all">
              <span className="font-mono text-accent mr-2">{String.fromCharCode(65 + i)}.</span> {o}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
