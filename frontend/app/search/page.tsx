import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search | thread",
  description: "Search and explore products",
};

export default function SearchPage() {
  return (
    <main className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-semibold">Search</h1>
      <p className="mt-2 text-muted-foreground">
        Semantic search and 3D graph will go here (Phase 2–3).
      </p>
    </main>
  );
}
