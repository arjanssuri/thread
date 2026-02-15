import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import sharp from "sharp";

/**
 * POST /api/preferences/photo
 * Accepts an image file (any format including HEIC), converts to JPEG via sharp,
 * uploads to Supabase storage, and returns the public URL.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("photo") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Convert any image format (HEIC, PNG, WebP, etc.) to JPEG
    const jpegBuffer = await sharp(buffer)
      .jpeg({ quality: 90 })
      .toBuffer();

    const path = `${user.id}/photo.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("user-photos")
      .upload(path, jpegBuffer, { contentType: "image/jpeg", upsert: true });

    if (uploadError) {
      console.error("[photo] Upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from("user-photos")
      .getPublicUrl(path);

    const photoUrl = urlData.publicUrl + `?t=${Date.now()}`;

    return NextResponse.json({ photoUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Photo upload failed";
    console.error("[photo]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
