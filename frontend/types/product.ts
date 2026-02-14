/**
 * Shared types for products and graph (used once Phase 2+ is implemented).
 */
export interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  category: string | null;
  metadata?: Record<string, unknown>;
}

export interface ProductWithScore extends Product {
  similarity?: number;
}
