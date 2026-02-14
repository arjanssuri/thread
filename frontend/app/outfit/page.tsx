import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Outfit | thread",
  description: "Visualize and try on outfits",
};

export default function OutfitPage() {
  return (
    <main className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-semibold">Outfit</h1>
      <p className="mt-2 text-muted-foreground">
        Outfit builder and try-on will go here (Phase 4).
      </p>
    </main>
  );
}
