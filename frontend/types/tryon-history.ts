export interface TryOnHistoryRecord {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  product_image_url: string | null;
  product_category: string | null;
  product_brand: string | null;
  product_price: number | null;
  video_url: string | null;
  created_at: string;
}

export type TryOnHistoryGrouped = Record<string, TryOnHistoryRecord[]>;
