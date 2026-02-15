import { createServiceRoleClient } from "@/lib/supabase/server";
import { computeEmbeddingsForBackfill } from "@/lib/search/backfill";
import { SEARCH_CONFIG } from "@/lib/search/config";

export const dynamic = "force-dynamic";

/**
 * POST /api/search/backfill-embeddings
 * Fetches all products from Supabase, generates embeddings via Elasticsearch inference,
 * and updates each product's embedding column. Run once after seeding products.
 * Requires: ELASTICSEARCH_URL, ELASTICSEARCH_API_KEY, ELASTICSEARCH_INFERENCE_ID.
 */
export async function POST(): Promise<Response> {
  try {
    const supabase = createServiceRoleClient();

    const { data: rows, error } = await supabase
      .from(SEARCH_CONFIG.productsTable)
      .select("id, name, description, category, brand");

    if (error) {
      console.error("[backfill-embeddings] Supabase error:", error);
      return Response.json({ ok: false, error: error.message }, { status: 502 });
    }

    const list = Array.isArray(rows) ? rows : [];
    if (list.length === 0) {
      return Response.json({
        ok: true,
        updated: 0,
        message: "No products to backfill.",
      });
    }

    const toEmbed = list.map((row: { id: string; name?: string | null; description?: string | null; category?: string | null; brand?: string | null }) => ({
      id: String(row.id),
      text: [row.brand, row.name, row.category, row.description].filter(Boolean).join(" ").trim() || String(row.id),
    }));

    const results = await computeEmbeddingsForBackfill(toEmbed);

    let updated = 0;
    for (const { id, embedding } of results) {
      const { error: updateError } = await supabase
        .from(SEARCH_CONFIG.productsTable)
        .update({ embedding })
        .eq("id", id);
      if (updateError) {
        console.error("[backfill-embeddings] Update failed for", id, updateError);
      } else {
        updated++;
      }
    }

    return Response.json({
      ok: true,
      updated,
      total: list.length,
      message: `Updated embeddings for ${updated} of ${list.length} products.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backfill failed";
    console.error("[backfill-embeddings]", err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
