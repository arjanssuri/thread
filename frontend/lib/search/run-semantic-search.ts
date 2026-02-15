import { SEARCH_CONFIG } from "@/lib/search/config";
import {
  ensureProductsIndex,
  getProductsIndexCount,
  inferEmbedding,
  searchProducts,
} from "@/lib/search/elasticsearch";
import { syncProductsFromSupabase } from "@/lib/search/sync-from-supabase";
import type { ProductWithScore } from "@/types/product";

/**
 * Run semantic search: embed query via Elasticsearch inference, then kNN search.
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

  const embedding = await inferEmbedding(trimmed);

  // Fetch more candidates than needed, then apply relevance cutoff
  const fetchLimit = Math.min(limit * 2, 500);

  await ensureProductsIndex();
  const count = await getProductsIndexCount();
  if (count === 0) {
    try {
      await syncProductsFromSupabase();
    } catch {
      // ignore
    }
  }

  let results = await searchProducts(embedding, { limit: fetchLimit, category, queryText: trimmed });

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
