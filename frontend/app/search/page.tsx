"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Search, X, LayoutList, ArrowLeft } from "lucide-react";
import type { GraphNode } from "@/components/search/product-graph";
import { TryOnPanel } from "@/components/outfit/try-on-panel";
import type { Product } from "@/types/product";

const ProductGraph = dynamic(
  () => import("@/components/search/product-graph").then((m) => m.ProductGraph),
  { ssr: false }
);

/** Convert a GraphNode to a Product for the TryOnPanel */
function nodeToProduct(node: GraphNode): Product {
  return {
    id: node.id,
    name: node.name,
    image_url: node.image_url,
    price: node.price,
    category: node.category,
    brand: node.brand,
    description: null,
    source: "",
    metadata: node.metadata ?? undefined,
  };
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [listOpen, setListOpen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [tryOnProduct, setTryOnProduct] = useState<Product | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch graph data
  const fetchGraph = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (q) params.set("q", q);
      const res = await fetch(`/api/products/graph?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setNodes(data.nodes ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchGraph("");
  }, [fetchGraph]);

  // Listen for header magnifying glass "open-search" event
  useEffect(() => {
    const handler = () => {
      if (searchActive) {
        inputRef.current?.focus();
      } else {
        setSearchActive(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    window.addEventListener("open-search", handler);
    return () => window.removeEventListener("open-search", handler);
  }, [searchActive]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchGraph(query);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchGraph]);

  const highlighted = nodes.filter((n) => n.highlighted);
  const hasQuery = query.trim().length > 0;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0a0a]">
      {/* ── 3D Graph ─────────────────────────────────── */}
      <div
        className={`absolute inset-0 transition-all duration-500 ${
          listOpen ? "right-[40%]" : "right-0"
        }`}
      >
        {nodes.length > 0 && (
          <ProductGraph
            nodes={nodes}
            onNodeHover={setHoveredNode}
            onNodeClick={(node) => {
              setSelectedNode(node);
            }}
          />
        )}

        {/* Loading overlay */}
        {loading && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>

      {/* ── Blur overlay behind landing search bar ── */}
      <div
        className="absolute inset-0 z-10 bg-black/40 transition-all duration-700"
        style={{
          opacity: searchActive ? 0 : 1,
          pointerEvents: searchActive ? "none" : "auto",
          backdropFilter: searchActive ? "none" : "blur(6px)",
          WebkitBackdropFilter: searchActive ? "none" : "blur(6px)",
        }}
        onClick={() => setSearchActive(true)}
      />

      {/* ── Search bar (landing → top transition) ── */}
      <div
        className="absolute z-20 px-4 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          top: searchActive ? "24px" : "50%",
          left: searchActive ? (listOpen ? "30%" : "50%") : "50%",
          transform: searchActive
            ? "translateX(-50%) translateY(0)"
            : "translateX(-50%) translateY(-50%)",
          width: "100%",
          maxWidth: searchActive ? "40rem" : "56rem",
        }}
      >
        {/* Title text above search bar in landing state */}
        <div
          className="overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            maxHeight: searchActive ? 0 : 100,
            opacity: searchActive ? 0 : 1,
            marginBottom: searchActive ? 0 : 28,
          }}
        >
          <h1 className="text-center text-4xl font-bold text-white tracking-tight">
            Explore products
          </h1>
          <p className="mt-3 text-center text-base text-white/40">
            Search across the graph to discover items
          </p>
        </div>

        <div className="relative">
          <Search
            size={searchActive ? 20 : 24}
            className={`absolute top-1/2 -translate-y-1/2 text-white/40 transition-all duration-500 ${
              searchActive ? "left-6" : "left-8"
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !searchActive) setSearchActive(true);
              if (e.key === "Escape" && !searchActive) {
                setSearchActive(true);
                inputRef.current?.blur();
              }
            }}
            placeholder="Search products..."
            className={`w-full rounded-full border bg-white/25 backdrop-blur-2xl text-white placeholder:text-white/60 focus:bg-white/30 focus:outline-none transition-all duration-500 ${
              searchActive
                ? "border-white/30 focus:border-white/50 pl-14 pr-12 py-4 text-base shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_4px_30px_rgba(0,0,0,0.2)]"
                : "border-white/20 focus:border-white/40 pl-20 pr-14 py-7 text-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_8px_60px_rgba(0,0,0,0.4)]"
            }`}
            style={{
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              backdropFilter: "blur(40px) saturate(180%)",
            }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setListOpen(false);
                inputRef.current?.focus();
              }}
              className={`absolute top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors ${
                searchActive ? "right-5" : "right-7"
              }`}
            >
              <X size={searchActive ? 16 : 20} />
            </button>
          )}
        </div>

        {/* Result count + list toggle */}
        {hasQuery && searchActive && (
          <div className="mt-3 flex items-center justify-between px-2">
            <p className="text-xs text-white/40">
              {loading ? "Searching..." : `${highlighted.length} results`}
            </p>
            {highlighted.length > 0 && (
              <button
                onClick={() => setListOpen(!listOpen)}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:text-white hover:border-white/20 transition-all"
              >
                <LayoutList size={12} />
                {listOpen ? "Close list" : "Scroll view"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Hover tooltip ─────────────────────────────── */}
      {hoveredNode && (
        <div className="pointer-events-none absolute bottom-6 left-6 z-20 flex items-center gap-3 rounded-xl border border-white/10 bg-black/80 backdrop-blur-lg px-4 py-3 shadow-2xl">
          {hoveredNode.image_url && (
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/10">
              <Image
                src={hoveredNode.image_url}
                alt=""
                fill
                className="object-cover"
                sizes="48px"
              />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {hoveredNode.name}
            </p>
            <p className="text-xs text-white/40">
              {hoveredNode.brand}
              {hoveredNode.price != null && ` · $${hoveredNode.price.toFixed(2)}`}
            </p>
          </div>
        </div>
      )}

      {/* ── Selected node card ─────────────────────────── */}
      {selectedNode && (
        <div className="absolute bottom-6 right-6 z-20 w-72 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-2xl shadow-2xl overflow-hidden"
          style={{ WebkitBackdropFilter: "blur(40px) saturate(180%)", backdropFilter: "blur(40px) saturate(180%)" }}
        >
          {selectedNode.image_url && (
            <div className="relative h-48 w-full bg-white/5">
              <Image
                src={selectedNode.image_url}
                alt={selectedNode.name}
                fill
                className="object-cover"
                sizes="288px"
              />
            </div>
          )}
          <div className="p-4">
            {selectedNode.brand && (
              <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">
                {selectedNode.brand}
              </p>
            )}
            <p className="mt-1 text-sm font-semibold text-white leading-snug">
              {selectedNode.name}
            </p>
            <div className="mt-2 flex items-center gap-2">
              {selectedNode.price != null && (
                <span className="text-sm font-bold text-white/90">
                  ${selectedNode.price.toFixed(2)}
                </span>
              )}
              {selectedNode.category && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50 capitalize">
                  {selectedNode.category}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setTryOnProduct(nodeToProduct(selectedNode));
                setSelectedNode(null);
              }}
              className="mt-3 w-full rounded-full bg-white py-2 text-xs font-semibold text-black hover:bg-white/90 transition-colors"
            >
              View details
            </button>
          </div>
          <button
            onClick={() => setSelectedNode(null)}
            className="absolute top-2 right-2 rounded-full bg-black/40 p-1.5 text-white/60 hover:text-white hover:bg-black/60 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Back button (top-left, hidden in landing state) ── */}
      <a
        href="/"
        className={`absolute top-6 left-6 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/50 backdrop-blur-lg px-4 py-2 text-xs text-white/60 hover:text-white hover:border-white/20 transition-all duration-500 ${
          searchActive ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <ArrowLeft size={14} />
        Back
      </a>

      {/* ── Right panel: scroll list ──────────────────── */}
      <div
        className={`absolute top-0 right-0 bottom-0 z-10 w-[40%] border-l border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl transition-transform duration-500 ${
          listOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Panel header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0a0a0a] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Results</h2>
            <p className="text-xs text-white/40">{highlighted.length} items</p>
          </div>
          <button
            onClick={() => setListOpen(false)}
            className="rounded-full p-2 text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Cards */}
        <div className="h-[calc(100%-65px)] overflow-y-auto p-6 space-y-5">
          {highlighted.map((node) => (
            <div
              key={node.id}
              onClick={() => setTryOnProduct(nodeToProduct(node))}
              className="group flex gap-5 rounded-2xl border-2 border-white/20 bg-white p-6 hover:border-white/40 hover:shadow-lg transition-all cursor-pointer"
            >
              {node.image_url && (
                <div className="relative h-36 w-28 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                  <Image
                    src={node.image_url}
                    alt={node.name}
                    fill
                    className="object-cover"
                    sizes="112px"
                    loading="eager"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1 py-1">
                {node.brand && (
                  <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                    {node.brand}
                  </p>
                )}
                <p className="mt-1 text-base font-semibold text-neutral-900 leading-snug line-clamp-2">
                  {node.name}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  {node.price != null && (
                    <span className="text-base font-bold text-neutral-800">
                      ${node.price.toFixed(2)}
                    </span>
                  )}
                  {node.category && (
                    <span className="rounded-full bg-neutral-100 border border-neutral-200 px-2.5 py-0.5 text-xs text-neutral-500 capitalize">
                      {node.category}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Try-on panel (same as outfit page) ────────── */}
      {tryOnProduct && (
        <TryOnPanel
          product={tryOnProduct}
          onClose={() => setTryOnProduct(null)}
        />
      )}
    </div>
  );
}
