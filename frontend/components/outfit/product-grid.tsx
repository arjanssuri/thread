"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Grid3X3, LayoutGrid, X } from "lucide-react";
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

const COLUMN_OPTIONS = [3, 4, 5] as const;

interface ProductGridProps {
  onSelect: (product: Product) => void;
  selectedId?: string;
}

export function ProductGrid({ onSelect, selectedId }: ProductGridProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("pant");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [columns, setColumns] = useState<3 | 4 | 5>(4);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const loaderRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Listen for header magnifying glass "open-search" event
  useEffect(() => {
    const handler = () => {
      setSearchOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    };
    window.addEventListener("open-search", handler);
    return () => window.removeEventListener("open-search", handler);
  }, []);

  // Debounce search query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const fetchProducts = useCallback(
    async (reset = false) => {
      const newOffset = reset ? 0 : offset;
      setLoading(true);

      try {
        const params = new URLSearchParams({
          limit: "40",
          offset: String(newOffset),
        });
        if (category !== "all") params.set("category", category);
        if (debouncedQuery) params.set("q", debouncedQuery);

        const res = await fetch(`/api/products?${params}`);
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
    [category, debouncedQuery, offset]
  );

  // Reset on category or search change
  useEffect(() => {
    setProducts([]);
    setOffset(0);
    fetchProducts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, debouncedQuery]);

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

  const gridClass =
    columns === 3
      ? "grid grid-cols-2 gap-4 sm:grid-cols-3 gap-y-8"
      : columns === 5
        ? "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-6"
        : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 gap-y-8";

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="relative mb-5">
        {!searchOpen ? (
          <button
            onClick={() => {
              setSearchOpen(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className="flex items-center gap-2.5 rounded-full border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground hover:border-foreground/20 hover:bg-secondary transition-all w-full"
          >
            <Search size={18} />
            Search products...
          </button>
        ) : (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onBlur={() => {
                if (!searchQuery) setSearchOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchQuery("");
                  setSearchOpen(false);
                }
              }}
              placeholder="Search products..."
              className="w-full rounded-full border border-foreground/20 bg-background pl-11 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/30 shadow-lg transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Category filters + column toggle */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
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

        {/* Column toggle */}
        <div className="hidden md:flex items-center gap-1 shrink-0 rounded-full border border-border p-1">
          {COLUMN_OPTIONS.map((col) => (
            <button
              key={col}
              onClick={() => setColumns(col)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                columns === col
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {col === 3 ? <LayoutGrid size={12} /> : <Grid3X3 size={12} />}
              {col}
            </button>
          ))}
        </div>
      </div>

      {/* Product count */}
      <p className="mb-4 text-sm text-muted-foreground">
        {total.toLocaleString()} items
        {debouncedQuery && ` matching "${debouncedQuery}"`}
      </p>

      {/* Grid */}
      <div className={gridClass}>
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
