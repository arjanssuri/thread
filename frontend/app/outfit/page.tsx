"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { ProductGrid } from "@/components/outfit/product-grid";
import { TryOnPanel } from "@/components/outfit/try-on-panel";
import type { Product } from "@/types/product";

export default function OutfitPage() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  return (
    <main className="min-h-screen bg-background">
      <Header />

      {/* Spacer for fixed header */}
      <div className="pt-28" />

      {/* Page header */}
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Try On
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Browse pieces and see them on you — in 3D or with AI.
        </p>
      </div>

      {/* Product grid */}
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-12">
        <ProductGrid
          onSelect={setSelectedProduct}
          selectedId={selectedProduct?.id}
        />
      </div>

      {/* Try-on panel (slide-over) */}
      {selectedProduct && (
        <TryOnPanel
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </main>
  );
}
