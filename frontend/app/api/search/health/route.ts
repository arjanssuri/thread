import {
  isElasticsearchConfigured,
  getElasticsearchInferenceId,
  getProductsIndexCount,
} from "@/lib/search/elasticsearch";

export const dynamic = "force-dynamic";

export type SearchHealthResponse =
  | { ok: true; message: string; indexedProducts: number }
  | { ok: false; error: string };

/**
 * GET /api/search/health
 * Verifies that Elasticsearch is configured and the products index has documents.
 */
export async function GET(): Promise<Response> {
  try {
    if (!isElasticsearchConfigured()) {
      return Response.json(
        {
          ok: false,
          error: "ELASTICSEARCH_URL is not set.",
        } satisfies SearchHealthResponse,
        { status: 502 }
      );
    }

    const inferenceId = getElasticsearchInferenceId();
    if (!inferenceId) {
      return Response.json(
        {
          ok: false,
          error: "ELASTICSEARCH_INFERENCE_ID is not set.",
        } satisfies SearchHealthResponse,
        { status: 502 }
      );
    }

    const count = await getProductsIndexCount();

    return Response.json({
      ok: true,
      message: `Elasticsearch ready. Inference endpoint: ${inferenceId}. ${count} products indexed.`,
      indexedProducts: count,
    } satisfies SearchHealthResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Health check failed";
    return Response.json(
      { ok: false, error: message } satisfies SearchHealthResponse,
      { status: 500 }
    );
  }
}
