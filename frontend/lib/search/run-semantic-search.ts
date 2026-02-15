import { createClient } from "@/lib/supabase/server";
import { getEmbedding } from "@/lib/embeddings";
import { SEARCH_CONFIG } from "@/lib/search/config";
import {
  isElasticsearchConfigured,
  useElasticsearchInference,
  ensureProductsIndex,
  getProductsIndexCount,
  inferEmbedding,
  searchProducts,
} from "@/lib/search/elasticsearch";
import { syncProductsFromSupabase } from "@/lib/search/sync-from-supabase";
import type { ProductWithScore } from "@/types/product";

/**
 * Run semantic search: embed query, then kNN (Elasticsearch) or match_products (pgvector).
 * Used by POST /api/search and GET /api/products/graph when query is present.
 */
export async function runSemanticSearch(
  query: string,
  options: { limit?: number; category?: string | null } = {}
): Promise<ProductWithScore[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const limit = Math.min(options.limit ?? SEARCH_CONFIG.defaultLimit, 500);
  const category =
    typeof options.category === "string" && options.category.trim()
      ? options.category.trim()
      : null;

  const embedding = await (useElasticsearchInference()
    ? inferEmbedding(trimmed)
    : getEmbedding(trimmed));

  // Fetch more candidates than needed, then apply relevance cutoff
  const fetchLimit = Math.min(limit * 2, 500);

  let results: ProductWithScore[];

  if (isElasticsearchConfigured()) {
    await ensureProductsIndex();
    const count = await getProductsIndexCount();
    if (count === 0) {
      try {
        await syncProductsFromSupabase();
      } catch {
        // ignore
      }
    }
    results = await searchProducts(embedding, { limit: fetchLimit, category });
  } else {
    const supabase = await createClient();
    const { data: rows, error } = await supabase.rpc(SEARCH_CONFIG.matchProductsRpc, {
      query_embedding: embedding,
      match_limit: fetchLimit,
      match_threshold: 0,
      filter_category: category,
    });

    if (error) throw new Error(error.message);

    results = (Array.isArray(rows) ? rows : []).map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      description: row.description != null ? String(row.description) : null,
      image_url: row.image_url != null ? String(row.image_url) : null,
      price: row.price != null ? Number(row.price) : null,
      category: row.category != null ? String(row.category) : null,
      brand: row.brand != null ? String(row.brand) : null,
      source: String(row.source ?? ""),
      metadata:
        row.metadata != null && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : undefined,
      similarity: typeof row.similarity === "number" ? row.similarity : undefined,
    }));
  }

  // Apply relevance cutoff: drop results below 40% of the top score
  if (results.length > 0) {
    const topScore = results[0].similarity;
    if (typeof topScore === "number" && topScore > 0) {
      const threshold = topScore * 0.4;
      results = results.filter((r) => (r.similarity ?? 0) >= threshold);
    }
  }

  return results.slice(0, limit);
}
