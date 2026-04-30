import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/authService";
import { useAuth } from "@/lib/auth-context";
import { AuthShell, Divider, OAuthButtons } from "./login";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Create account — Ace It Up" }] }),
  component: Register,
});

function Register() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/dashboard" });
  }, [user, authLoading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || password.length < 6) {
      return toast.error("Fill all fields. Password must be 6+ characters.");
    }
    setBusy(true);
    try {
      const data = await authService.signUp(email, password, name);
      
      // If email confirmation is enabled in Supabase, session will be null
      if (!data.session) {
        toast.success("Please check your email to confirm your account!");
        return;
      }

      toast.success("Account created — welcome to Ace It Up!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setBusy(false);
    }
  }

  async function oauth() {
    setBusy(true);
    try {
      await authService.signInWithGoogle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Start your placement prep in seconds.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="mt-1.5" />
        </div>
        <Button type="submit" disabled={busy} className="w-full bg-gradient-primary border-0 shadow-glow">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create account"}
        </Button>
      </form>

      <Divider />
      <OAuthButtons onClick={oauth} disabled={busy} />

      <p className="text-sm text-center text-muted-foreground mt-6">
        Already a member? <Link to="/login" className="text-accent hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
