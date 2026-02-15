/**
 * Search schema contract — align with your partner's products table and RPC.
 * If their schema uses different names, update these constants so the Search API
 * and RPC stay in sync.
 */
export const SEARCH_CONFIG = {
  /** Table name for products */
  productsTable: "products" as const,
  /** Default limit for search results */
  defaultLimit: 20,
} as const;

/**
 * Elasticsearch index vector size. Set via ELASTICSEARCH_EMBEDDING_DIMENSION env var.
 * E5 small = 384 (default).
 */
export function getElasticsearchEmbeddingDimension(): number {
  const n = Number(process.env.ELASTICSEARCH_EMBEDDING_DIMENSION);
  return Number.isFinite(n) && n > 0 ? n : 384;
}
