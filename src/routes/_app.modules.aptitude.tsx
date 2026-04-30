import { createFileRoute } from "@tanstack/react-router";
import { Aptitude } from "@/components/modules/Aptitude";

export const Route = createFileRoute("/_app/modules/aptitude")({
  head: () => ({ meta: [{ title: "Aptitude — Ace It Up" }] }),
  component: () => (
    <div className="max-w-3xl mx-auto space-y-4">
      <ModuleHeader title="Aptitude Practice" subtitle="Timed multiple-choice questions to sharpen your problem-solving." />
      <Aptitude />
    </div>
  ),
});

function ModuleHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-1 md:px-0">
      <h1 className="text-xl md:text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="text-xs md:text-base text-muted-foreground mt-0.5 md:mt-1">{subtitle}</p>
    </div>
  );
}
