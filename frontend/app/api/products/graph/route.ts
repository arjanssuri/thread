import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Returns products with 3D positions for the graph view.
 * Clusters by category with jitter. When embeddings are ready,
 * positions can be replaced with t-SNE / UMAP projections.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit") ?? 500), 2000);
  const q = searchParams.get("q")?.trim();

  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select("id, name, image_url, price, category, brand, source")
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Basic text search for now — will be replaced with vector similarity
  if (q) {
    query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%,brand.ilike.%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also fetch full set for graph if searching (so non-matches still show as dim nodes)
  let allData = data;
  const matchIds = new Set<string>();

  if (q && data) {
    data.forEach((p) => matchIds.add(p.id));

    // Get background nodes too
    const { data: bgData } = await supabase
      .from("products")
      .select("id, name, image_url, price, category, brand, source")
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (bgData) {
      const idSet = new Set(bgData.map((p) => p.id));
      // Merge: background + any matches not already in background
      const extras = data.filter((p) => !idSet.has(p.id));
      allData = [...bgData, ...extras];
    }
  }

  // Assign 3D positions clustered by category
  const categoryMap = new Map<string, number>();
  let catIdx = 0;

  const nodes = (allData ?? []).map((product, i) => {
    const cat = (product.category ?? "other").toLowerCase();
    if (!categoryMap.has(cat)) categoryMap.set(cat, catIdx++);
    const ci = categoryMap.get(cat)!;
    const total = categoryMap.size || 1;

    // Spread categories in a ring
    const angle = (ci / Math.max(total, 8)) * Math.PI * 2;
    const radius = 30 + (ci % 3) * 12;

    // Seeded pseudo-random jitter per product
    const seed = hashCode(product.id);
    const jx = seededRandom(seed) * 18 - 9;
    const jy = seededRandom(seed + 1) * 18 - 9;
    const jz = seededRandom(seed + 2) * 18 - 9;

    return {
      ...product,
      position: [
        Math.cos(angle) * radius + jx,
        jy,
        Math.sin(angle) * radius + jz,
      ] as [number, number, number],
      highlighted: q ? matchIds.has(product.id) : false,
    };
  });

  return NextResponse.json({ nodes, categories: [...categoryMap.keys()] });
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}
