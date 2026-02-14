import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent | thread",
  description: "AI shopping agent",
};

export default function AgentPage() {
  return (
    <main className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-semibold">AI Shopping Agent</h1>
      <p className="mt-2 text-muted-foreground">
        Preferences and agent dashboard will go here (Phase 5).
      </p>
    </main>
  );
}
