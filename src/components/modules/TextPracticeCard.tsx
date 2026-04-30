// Shared text-based module (used by GD, Communication, Interview).
import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { feedbackService, type FeedbackResult } from "@/services/feedbackService";
import { moduleService } from "@/services/moduleService";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { Sparkles, Loader2, Mic, Square } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ModuleKey = Database["public"]["Enums"]["module_key"];

export function TextPracticeCard({
  module,
  title,
  icon,
  prompt,
  setPrompt,
  promptOptions,
  before,
}: {
  module: Exclude<ModuleKey, "aptitude">;
  title: string;
  icon: React.ReactNode;
  prompt: string;
  setPrompt: (s: string) => void;
  promptOptions?: string[];
  before?: React.ReactNode;
}) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [fb, setFb] = useState<FeedbackResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());

  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Reset timer when prompt changes.
  useEffect(() => { 
    setStartedAt(Date.now()); 
    setFb(null); 
    setText(""); 
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  }, [prompt]);

  const speak = (content: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Your browser doesn't support speech recognition. Try Chrome or Safari.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      
      recognition.onstart = () => {
        setIsRecording(true);
        if (navigator.vibrate) navigator.vibrate(50);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setText(prev => {
            const lastChar = prev.trim().slice(-1);
            const needsSpace = prev.length > 0 && !prev.endsWith(" ") && !".?!".includes(lastChar);
            return prev + (needsSpace ? " " : "") + finalTranscript;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
          toast.error("Microphone access denied. Please enable it in settings.");
        } else {
          toast.error(`Recording error: ${event.error}`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      toast.error("Failed to start recording");
      console.error(err);
    }
  };

  async function submit() {
    if (!text.trim() || !user) return;
    const timeSpentMs = Date.now() - startedAt;
    setBusy(true);
    setFb(null);
    try {
      const result = await feedbackService.analyze({ module, prompt, answer: text });
      setFb(result);
      await moduleService.saveAttempt({
        userId: user.id,
        module,
        score: result.score,
        detail: prompt,
        prompt,
        answer: text,
        feedback: result,
        topic: module,
        timeSpentMs,
      });
      toast.success(`Scored ${result.score}/100 · saved to progress`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Feedback failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">{icon} {title}</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => speak(prompt)} className="h-8 w-8 text-muted-foreground hover:text-accent" title="Listen to prompt">
            <Mic className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4">
          {before}
          {promptOptions && (
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {promptOptions.map((p) => (
                <button
                  key={p}
                  onClick={() => setPrompt(p)}
                  className={`text-xs px-2.5 md:px-3 py-1 md:py-1.5 rounded-full border transition-all ${
                    prompt === p ? "bg-gradient-primary text-primary-foreground border-transparent" : "border-border hover:border-accent"
                  }`}
                >
                  {p.length > 28 ? p.slice(0, 26) + "…" : p}
                </button>
              ))}
            </div>
          )}
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer, or click the mic to speak. AI will score structure, clarity, grammar, and fluency."
            rows={7}
            className="resize-none text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground shrink-0">{text.trim().split(/\s+/).filter(Boolean).length} words</p>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleRecording}
              className={`text-xs transition-all shrink-0 ${isRecording ? 'border-destructive text-destructive bg-destructive/10 hover:bg-destructive/20 animate-pulse' : 'hover:border-accent hover:text-accent'}`}
            >
              {isRecording ? <><Square className="w-3.5 h-3.5 mr-1" fill="currentColor" /> Stop</> : <><Mic className="w-3.5 h-3.5 mr-1" /> Speak</>}
            </Button>
          </div>
          <Button onClick={submit} disabled={!text.trim() || busy || isRecording} className="w-full bg-gradient-primary border-0">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {busy ? "Analyzing…" : "Get AI feedback"}
          </Button>
        </CardContent>
      </Card>

      <FeedbackPanel feedback={fb} loading={busy} emptyHint="Submit your answer to receive instant AI feedback." />
    </div>
  );
}
