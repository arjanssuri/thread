"use server";

import { inferEmbeddings } from "@/lib/search/elasticsearch";

/**
 * Item your partner's code can pass after fetching from the products table.
 * Use description or (name + " " + description) for best semantic quality.
 */
export interface ProductRowForBackfill {
  id: string;
  /** Text to embed (e.g. product description or name + description). */
  text: string;
}

export interface BackfillResultRow {
  id: string;
  embedding: number[];
}

const BATCH_SIZE = 50; // ES inference batch limit

/**
 * Compute embeddings for products in batches via Elasticsearch inference.
 * (1) fetch products from DB, (2) call this with id + text, (3) update products.embedding in DB.
 */
export async function computeEmbeddingsForBackfill(
  products: ProductRowForBackfill[]
): Promise<BackfillResultRow[]> {
  if (products.length === 0) return [];

  const results: BackfillResultRow[] = [];
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const texts = batch.map((p) => p.text.trim().slice(0, 8191) || p.id);
    const embeddings = await inferEmbeddings(texts);
    if (embeddings.length !== batch.length) {
      throw new Error(
        `Embedding count mismatch: got ${embeddings.length}, expected ${batch.length}`
      );
    }
    for (let j = 0; j < batch.length; j++) {
      results.push({
        id: batch[j].id,
        embedding: embeddings[j],
      });
    }
  }
  return results;
}
