import { Client } from "@elastic/elasticsearch";
import { SEARCH_CONFIG } from "./config";
import type { ProductWithScore } from "@/types/product";

const INDEX_NAME = "products";

function getClient(): Client | null {
  const url = process.env.ELASTICSEARCH_URL;
  const apiKey = process.env.ELASTICSEARCH_API_KEY;
  if (!url?.trim()) return null;
  return new Client({
    node: url,
    ...(apiKey?.trim() && { auth: { apiKey } }),
  });
}

export const elasticsearchClient = getClient();

export function isElasticsearchConfigured(): boolean {
  return Boolean(process.env.ELASTICSEARCH_URL?.trim());
}

/** When set, query and product embeddings use Elasticsearch inference instead of OpenAI. */
export function getElasticsearchInferenceId(): string | null {
  const id = process.env.ELASTICSEARCH_INFERENCE_ID;
  return id?.trim() || null;
}

export function useElasticsearchInference(): boolean {
  return isElasticsearchConfigured() && Boolean(getElasticsearchInferenceId());
}

const INFERENCE_BATCH_SIZE = 50;

const DEPLOYMENT_TIMEOUT_RETRY_DELAY_MS = 45_000; // wait then retry once after cold-start timeout

function isDeploymentTimeout(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("model_deployment_timeout_exception") || msg.includes("waiting for trained model deployment");
}

/**
 * Call Elasticsearch Inference API to embed one or more texts.
 * Uses a long timeout and retries once on model cold-start timeout.
 */
async function callInferenceApi(
  input: string | string[],
  inputType: "SEARCH" | "INGEST" = "INGEST"
): Promise<number[][]> {
  const client = elasticsearchClient;
  const inferenceId = getElasticsearchInferenceId();
  if (!client || !inferenceId) throw new Error("Elasticsearch or ELASTICSEARCH_INFERENCE_ID not configured");

  const path = `/_inference/text_embedding/${inferenceId}`;
  const body = { input, input_type: inputType };

  const doRequest = async (): Promise<number[][]> => {
    const res = await client!.transport.request({
      method: "POST",
      path,
      body,
      querystring: { timeout: "2m" }, // let server wait for model deployment (cold start)
    });

    const obj = res as Record<string, unknown>;
    const expectedCount = Array.isArray(input) ? input.length : 1;

    // Official ES 8.11+ response: text_embedding = [ { embedding: number[] }, ... ]
    const textEmbedding = obj.text_embedding as Array<{ embedding?: number[] }> | undefined;
    if (Array.isArray(textEmbedding) && textEmbedding.length === expectedCount) {
      const vectors = textEmbedding
        .map((r) => r.embedding)
        .filter((v): v is number[] => Array.isArray(v) && v.every((n) => typeof n === "number"));
      if (vectors.length === expectedCount) return vectors;
    }

    // Fallbacks for other response shapes
    const topEmb = obj.embeddings as number[][] | undefined;
    if (Array.isArray(topEmb) && topEmb.length === expectedCount && topEmb.every((x) => Array.isArray(x))) return topEmb;

    const results = obj.inference_results as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(results) && results.length === expectedCount) {
      const vectors = results
        .map((r) => r.inferred_value ?? r.predicted_value ?? r.embedding as number[] | undefined)
        .filter((v): v is number[] => Array.isArray(v) && v.every((n) => typeof n === "number"));
      if (vectors.length === expectedCount) return vectors;
    }

    if (expectedCount === 1) {
      const single = (obj.inferred_value ?? obj.embedding) as number[] | undefined;
      if (Array.isArray(single) && single.every((n) => typeof n === "number")) return [single];
    }

    console.error("[inference] Unexpected response keys:", Object.keys(obj));
    throw new Error("Unexpected inference API response shape. Check server logs for response keys.");
  };

  try {
    return await doRequest();
  } catch (err) {
    if (isDeploymentTimeout(err)) {
      await new Promise((r) => setTimeout(r, DEPLOYMENT_TIMEOUT_RETRY_DELAY_MS));
      return doRequest();
    }
    throw err;
  }
}

/** Get a single embedding for a search query. Use input_type SEARCH for query. */
export async function inferEmbedding(text: string): Promise<number[]> {
  const vectors = await callInferenceApi(text.trim().slice(0, 8191) || " ", "SEARCH");
  const v = vectors[0];
  if (!v || !Array.isArray(v)) throw new Error("Inference returned no vector");
  return v;
}

/** Get embeddings for multiple texts (e.g. product name+description). Use input_type INGEST. */
export async function inferEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += INFERENCE_BATCH_SIZE) {
    const batch = texts.slice(i, i + INFERENCE_BATCH_SIZE);
    const input = batch.map((t) => t.trim().slice(0, 8191) || " ");
    const vectors = await callInferenceApi(input, "INGEST");
    results.push(...vectors);
  }
  return results;
}

/** Product document shape stored in Elasticsearch */
export interface ProductDocument {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  category: string | null;
  brand: string | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
  embedding: number[];
}

import { getElasticsearchEmbeddingDimension } from "./config";

const EMBEDDING_DIMS = getElasticsearchEmbeddingDimension();

/**
 * Returns the number of documents in the products index (0 if index does not exist).
 */
export async function getProductsIndexCount(): Promise<number> {
  const client = elasticsearchClient;
  if (!client) return 0;
  try {
    const exists = await client.indices.exists({ index: INDEX_NAME });
    if (!exists) return 0;
    const res = await client.count({ index: INDEX_NAME });
    return typeof res.count === "number" ? res.count : 0;
  } catch {
    return 0;
  }
}

/**
 * Ensure the products index exists with a dense_vector field for semantic search.
 * Call once before indexing or searching (e.g. from index API or on first search).
 */
export async function ensureProductsIndex(): Promise<void> {
  const client = elasticsearchClient;
  if (!client) throw new Error("Elasticsearch is not configured (ELASTICSEARCH_URL)");

  const exists = await client.indices.exists({ index: INDEX_NAME });
  if (exists) return;

  await client.indices.create({
    index: INDEX_NAME,
    mappings: {
      properties: {
        id: { type: "keyword" },
        name: { type: "text" },
        description: { type: "text" },
        image_url: { type: "keyword", index: false },
        price: { type: "float" },
        category: { type: "keyword" },
        brand: { type: "keyword" },
        source: { type: "keyword" },
        metadata: { type: "object", enabled: false },
        embedding: {
          type: "dense_vector",
          dims: EMBEDDING_DIMS,
          index: true,
          similarity: "cosine",
        },
      },
    },
  });
}

// Common color names used to detect color intent in queries
const COLOR_KEYWORDS = new Set([
  "red", "blue", "green", "black", "white", "yellow", "orange", "purple",
  "pink", "brown", "grey", "gray", "navy", "beige", "cream", "tan",
  "burgundy", "maroon", "olive", "teal", "coral", "gold", "silver",
  "charcoal", "ivory", "khaki", "lavender", "mint", "nude", "rust",
  "sage", "salmon", "turquoise", "wine", "indigo", "cyan", "magenta",
  "mauve", "peach", "plum", "taupe", "camel", "cobalt", "emerald",
  "forest", "hunter", "lilac", "moss", "mustard", "oatmeal", "rose",
  "slate", "stone", "terracotta",
]);

/** Extract color words from a text query */
function extractColors(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => COLOR_KEYWORDS.has(w));
}

/**
 * Hybrid semantic search: kNN over embeddings + text match boost for colors.
 * When the query contains color words, results matching those colors in name/description
 * get a significant score boost so they rank higher.
 */
export async function searchProducts(
  queryEmbedding: number[],
  options: { limit?: number; category?: string | null; queryText?: string } = {}
): Promise<ProductWithScore[]> {
  const client = elasticsearchClient;
  if (!client) throw new Error("Elasticsearch is not configured");

  const limit = Math.min(options.limit ?? SEARCH_CONFIG.defaultLimit, 500);

  const knnClause = {
    knn: {
      field: "embedding",
      query_vector: queryEmbedding,
      k: limit,
      num_candidates: Math.max(limit * 2, 100),
    },
  };

  // Detect colors in the original query text
  const colors = options.queryText ? extractColors(options.queryText) : [];

  // Build should clauses that boost color matches in name and description
  const colorBoosts =
    colors.length > 0
      ? colors.flatMap((color) => [
          { match: { name: { query: color, boost: 15 } } },
          { match: { description: { query: color, boost: 10 } } },
        ])
      : [];

  let query: Record<string, unknown>;

  if (options.category?.trim() && colorBoosts.length > 0) {
    query = {
      bool: {
        must: [knnClause, { term: { category: options.category.trim() } }],
        should: colorBoosts,
      },
    };
  } else if (options.category?.trim()) {
    query = {
      bool: {
        must: [knnClause, { term: { category: options.category.trim() } }],
      },
    };
  } else if (colorBoosts.length > 0) {
    query = {
      bool: {
        must: [knnClause],
        should: colorBoosts,
      },
    };
  } else {
    query = knnClause;
  }

  const body: Record<string, unknown> = {
    size: limit,
    query,
  };

  const res = await client.search({
    index: INDEX_NAME,
    body,
  });

  const hits = (res.hits?.hits ?? []) as Array<{
    _source?: ProductDocument;
    _score?: number;
  }>;

  // Normalize scores to 0-1 range (hybrid boosted scores can exceed 1.0)
  const maxScore = hits.reduce((m, h) => Math.max(m, h._score ?? 0), 0);

  return hits.map((hit) => {
    const s = hit._source;
    if (!s) return null;
    const rawScore = typeof hit._score === "number" ? hit._score : 0;
    const similarity = maxScore > 0 ? rawScore / maxScore : 0;
    const product: ProductWithScore = {
      id: s.id,
      name: s.name ?? "",
      description: s.description ?? null,
      image_url: s.image_url ?? null,
      price: s.price ?? null,
      category: s.category ?? null,
      brand: s.brand ?? null,
      source: s.source ?? "",
      metadata: s.metadata ?? undefined,
      similarity,
    };
    return product;
  }).filter(Boolean) as ProductWithScore[];
}

/**
 * Index one product (for incremental updates).
 */
export async function indexProduct(doc: ProductDocument): Promise<void> {
  const client = elasticsearchClient;
  if (!client) throw new Error("Elasticsearch is not configured");
  await client.index({
    index: INDEX_NAME,
    id: doc.id,
    document: doc,
    refresh: true,
  });
}

/**
 * Bulk index products (for initial sync or re-index from Supabase).
 */
export async function indexProducts(docs: ProductDocument[]): Promise<{ indexed: number; errors: string[] }> {
  const client = elasticsearchClient;
  if (!client) throw new Error("Elasticsearch is not configured");

  if (docs.length === 0) return { indexed: 0, errors: [] };

  const operations = docs.flatMap((doc) => [
    { index: { _index: INDEX_NAME, _id: doc.id } },
    doc,
  ]);

  const result = await client.bulk({
    refresh: true,
    operations,
  });

  const errors: string[] = [];
  if (result.errors) {
    const items = (result.items ?? []) as Array<{ index?: { error?: { reason?: string } } }>;
    for (const item of items) {
      if (item.index?.error?.reason) errors.push(item.index.error.reason);
    }
  }
  const indexed = docs.length - errors.length;
  return { indexed, errors };
}
