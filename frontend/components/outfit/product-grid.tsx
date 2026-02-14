"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ProductCard } from "./product-card";
import type { Product } from "@/types/product";

const CATEGORIES = [
  { label: "All", value: "all" },
  { label: "Tops", value: "top" },
  { label: "Shirts", value: "shirt" },
  { label: "Dresses", value: "dress" },
  { label: "Pants", value: "pant" },
  { label: "Shoes", value: "shoe" },
  { label: "Bags", value: "bag" },
  { label: "Jackets", value: "jacket" },
  { label: "Accessories", value: "accessories" },
];

interface ProductGridProps {
  onSelect: (product: Product) => void;
  selectedId?: string;
}

export function ProductGrid({ onSelect, selectedId }: ProductGridProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const loaderRef = useRef<HTMLDivElement>(null);

  const fetchProducts = useCallback(
    async (reset = false) => {
      const newOffset = reset ? 0 : offset;
      setLoading(true);

      try {
        const res = await fetch(
          `/api/products?category=${category}&limit=40&offset=${newOffset}`
        );
        const data = await res.json();

        if (reset) {
          setProducts(data.products ?? []);
          setOffset(40);
        } else {
          setProducts((prev) => [...prev, ...(data.products ?? [])]);
          setOffset(newOffset + 40);
        }
        setTotal(data.total ?? 0);
      } catch {
        console.error("Failed to fetch products");
      } finally {
        setLoading(false);
      }
    },
    [category, offset]
  );

  // Reset on category change
  useEffect(() => {
    setProducts([]);
    setOffset(0);
    fetchProducts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && products.length < total) {
          fetchProducts(false);
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, products.length, total]);

  return (
    <div className="flex flex-col h-full">
      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
              category === cat.value
                ? "bg-foreground text-background"
                : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Product count */}
      <p className="mb-4 text-sm text-muted-foreground">
        {total.toLocaleString()} items
      </p>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 gap-y-8">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onSelect={onSelect}
            selected={product.id === selectedId}
          />
        ))}
      </div>

      {/* Loading / infinite scroll trigger */}
      <div ref={loaderRef} className="flex justify-center py-8">
        {loading && (
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
            <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
            <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
          </div>
        )}
        {!loading && products.length >= total && products.length > 0 && (
          <p className="text-sm text-muted-foreground">That&apos;s everything</p>
        )}
      </div>
    </div>
  );
}
