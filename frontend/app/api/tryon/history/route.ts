import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TryOnHistoryRecord, TryOnHistoryGrouped } from "@/types/tryon-history";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("tryon_history")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const grouped: TryOnHistoryGrouped = {};
  for (const record of (data as TryOnHistoryRecord[])) {
    const cat = record.product_category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(record);
  }

  return NextResponse.json({ history: grouped });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { product_id, product_name, product_image_url, product_category, product_brand, product_price, video_url } = body;

  if (!product_id || !product_name) {
    return NextResponse.json({ error: "product_id and product_name are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tryon_history")
    .insert({
      user_id: user.id,
      product_id,
      product_name,
      product_image_url: product_image_url || null,
      product_category: product_category || null,
      product_brand: product_brand || null,
      product_price: product_price ?? null,
      video_url: video_url || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ record: data }, { status: 201 });
}
