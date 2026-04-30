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
  const [mode, setMode] = useState<"config" | "loading" | "test" | "done">("config");
  const [questions, setQuestions] = useState<AptitudeQuestion[]>([]);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [source, setSource] = useState<"ai" | "fallback">("fallback");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [perQTime, setPerQTime] = useState<number[]>([]);
  const [time, setTime] = useState(TIME_PER_Q);
  const [saving, setSaving] = useState(false);
  const [qCount, setQCount] = useState(5);
  const qStartRef = useRef<number>(Date.now());

  const speak = (content: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const seenIdsRef = useRef<Set<string>>(new Set());

  async function loadQuestions(count: number = qCount) {
    setMode("loading"); 
    setIdx(0); 
    setAnswers([]); 
    setPerQTime([]); 
    setTime(TIME_PER_Q);
    setQuestions([]);

    try {
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
      
      // Fetch a larger pool to allow filtering
      const res = await feedbackService.getAdaptiveQuestions({ 
        recentAvg, 
        weakTopics, 
        count: Math.max(count * 3, 20) 
      });
      
      // Filter out questions we've already seen
      let available = res.questions.filter(q => !seenIdsRef.current.has(q.id));
      
      // If we've run out of new questions, reset the 'seen' memory
      if (available.length < count) {
        seenIdsRef.current.clear();
        available = res.questions;
      }
      
      // Shuffle and pick the requested amount
      const selected = available
        .sort(() => Math.random() - 0.5)
        .slice(0, count);
      
      // Mark these as 'seen'
      selected.forEach(q => seenIdsRef.current.add(q.id));
      
      setQuestions(selected);
      setDifficulty(res.difficulty as "easy" | "medium" | "hard");
      setSource(res.source as "ai" | "fallback");
      qStartRef.current = Date.now();
      setMode("test");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load questions");
      setMode("config");
    }
  }

  // Soft countdown
  useEffect(() => {
    if (mode !== "test") return;
    if (time <= 0) return;
    const t = setTimeout(() => setTime((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [time, mode]);

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
    setMode("done");
    setSaving(true);
    try {
      const totalMs = times.reduce((a, b) => a + b, 0);
      await Promise.all(final.map((ans, i) => {
        const q = questions[i];
        if (!q) return Promise.resolve();
        const correct = ans === q.answer_index;
        return moduleService.saveAttempt({
          userId: user?.id || "",
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
      const pct = Math.round((final.reduce((a, ans, i) => a + (ans === questions[i]?.answer_index ? 1 : 0), 0) / questions.length) * 100);
      if (user) {
        await moduleService.saveAttempt({
          userId: user.id,
          module: "aptitude",
          score: pct,
          detail: `Session · ${final.length} Qs · ${difficulty}`,
          difficulty,
          topic: "session-summary",
          timeSpentMs: totalMs,
        });
      }
      void progressService.listAttempts(50);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save attempt");
    } finally {
      setSaving(false);
    }
  }

  if (mode === "config") {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Brain className="w-5 h-5 text-accent" /> Configure Aptitude Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 py-8">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold">How many questions?</h3>
            <p className="text-sm text-muted-foreground">Select the number of questions for this session.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 5, 10, 15, 20].map((n) => (
              <button
                key={n}
                onClick={() => setQCount(n)}
                className={`py-4 rounded-xl border-2 transition-all font-bold ${
                  qCount === n ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-accent/50"
                }`}
              >
                {n} {n === 1 ? 'Question' : 'Questions'}
              </button>
            ))}
          </div>
          <Button onClick={() => loadQuestions(qCount)} className="w-full bg-gradient-primary border-0 py-6 text-lg">
            Start Test <Sparkles className="w-5 h-5 ml-2" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mode === "loading") {
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

  if (mode === "done") {
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
          <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
            {questions.map((q, i) => {
              const correct = answers[i] === q.answer_index;
              return (
                <div key={q.id} className={`p-4 rounded-xl border text-sm transition-all ${correct ? "border-emerald-200 bg-emerald-50/50" : "border-destructive/20 bg-destructive/5"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-slate-800">{i + 1}. {q.question}</p>
                    <Button variant="ghost" size="icon" onClick={() => speak(q.question)} className="h-6 w-6 shrink-0">
                      <Mic className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className={`font-medium ${correct ? "text-emerald-600" : "text-destructive"}`}>
                      Your: {q.options[answers[i]] || "No answer"}
                    </p>
                    {!correct && <p className="text-emerald-600 font-medium">Correct: {q.options[q.answer_index]}</p>}
                  </div>
                  <div className="mt-3 p-3 rounded-lg bg-white/60 text-slate-600 text-xs border border-slate-100 italic">
                    {q.explanation}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Button variant="outline" onClick={() => setMode("config")} className="w-full">
              <RotateCcw className="w-4 h-4 mr-2" /> Change Settings
            </Button>
            <Button onClick={() => loadQuestions()} className="w-full bg-gradient-primary border-0">
              <RotateCcw className="w-4 h-4 mr-2" /> Retake Test
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const cur = questions[idx];
  if (!cur) return null;
  return (
    <Card className="shadow-card border-0 sm:border">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 pb-4">
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl"><Brain className="w-5 h-5 text-accent" /> Aptitude</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => speak(cur.question)} className="h-8 w-8 text-muted-foreground hover:text-accent" title="Listen to question">
            <Mic className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="capitalize text-[10px] sm:text-xs px-2 py-0">{difficulty}</Badge>
          <Badge variant="outline" className="text-[10px] gap-1 px-2 py-0">
            {source === "ai" ? <><Cpu className="w-3 h-3" /> AI</> : <><Wrench className="w-3 h-3" /> Bank</>}
          </Badge>
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono px-3 py-1 rounded-full bg-secondary">
            <Clock className="w-4 h-4" /> {String(Math.floor(time / 60)).padStart(2, "0")}:{String(time % 60).padStart(2, "0")}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        <Progress value={(idx / questions.length) * 100} className="h-1.5" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Question {idx + 1} of {questions.length}</span>
          <span className="inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> Topic: {cur.topic.replace(/-/g, " ")}</span>
        </div>
        <h3 className="text-xl font-bold leading-tight text-slate-900">{cur.question}</h3>
        <div className="grid gap-3">
          {cur.options.map((o, i) => (
            <button 
              key={i} 
              onClick={() => pick(i)} 
              className="group text-left px-5 py-4 rounded-xl border-2 border-border bg-white hover:border-accent hover:bg-accent/5 transition-all duration-300 flex items-center gap-4"
            >
              <div className="w-8 h-8 rounded-full border-2 border-border group-hover:border-accent group-hover:bg-accent text-slate-500 group-hover:text-white flex items-center justify-center font-bold text-sm shrink-0 transition-colors">
                {String.fromCharCode(65 + i)}
              </div>
              <span className="font-medium text-slate-700 group-hover:text-slate-900">{o}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
