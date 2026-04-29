import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Brain, Users, Mic, Briefcase, ArrowRight, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import ShaderShowcase from "@/components/ui/hero";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ace It Up — AI Placement Prep for Students" },
      { name: "description", content: "Crack campus placements with AI-powered aptitude, GD, communication, and interview practice." },
      { property: "og:title", content: "Ace It Up — AI Placement Prep" },
      { property: "og:description", content: "Practice with instant AI feedback. Track real progress." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return <ShaderShowcase />;
}
