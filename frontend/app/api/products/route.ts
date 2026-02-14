import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category");
  const brand = searchParams.get("brand");
  const limit = Math.min(Number(searchParams.get("limit") ?? 40), 100);
  const offset = Number(searchParams.get("offset") ?? 0);

  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select("id, name, description, image_url, price, category, brand, source, metadata", {
      count: "exact",
    })
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (category && category !== "all") {
    query = query.ilike("category", `%${category}%`);
  }

  if (brand) {
    query = query.ilike("brand", `%${brand}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: data, total: count });
}
