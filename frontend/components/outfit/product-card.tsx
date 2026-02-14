"use client";

import Image from "next/image";
import { useState } from "react";
import type { Product } from "@/types/product";

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  selected?: boolean;
}

export function ProductCard({ product, onSelect, selected }: ProductCardProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className={`group text-left w-full transition-all duration-200 ${
        selected ? "ring-2 ring-foreground rounded-xl" : ""
      }`}
    >
      {/* Image */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-secondary">
        {product.image_url && (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={`object-cover transition-all duration-500 group-hover:scale-105 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setLoaded(true)}
          />
        )}
        {!loaded && (
          <div className="absolute inset-0 animate-pulse bg-secondary" />
        )}
      </div>

      {/* Info */}
      <div className="mt-3 px-0.5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {product.brand}
        </p>
        <h3 className="mt-0.5 text-sm font-medium text-foreground line-clamp-1">
          {product.name}
        </h3>
        {product.price != null && (
          <p className="mt-0.5 text-sm text-foreground">
            ${product.price.toFixed(2)}
          </p>
        )}
      </div>
    </button>
  );
}
