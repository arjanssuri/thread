import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

async function uploadToStorage(videoBuffer: Buffer): Promise<string | null> {
  try {
    const supabase = await createClient();
    const filename = `${crypto.randomUUID()}.mp4`;
    const { error } = await supabase.storage
      .from("tryon-videos")
      .upload(filename, videoBuffer, { contentType: "video/mp4" });
    if (error) {
      console.error("Storage upload error:", error.message);
      return null;
    }
    const { data } = supabase.storage.from("tryon-videos").getPublicUrl(filename);
    return data.publicUrl;
  } catch (err) {
    console.error("Storage upload failed:", err);
    return null;
  }
}

/**
 * POST — Build prompt from pre-computed analysis, then start Veo video generation.
 * GET  — Poll status by operation name.
 */

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 501 }
    );
  }

  const { productName, productAnalysis, personAnalysis } = await request.json();

  if (!productName) {
    return NextResponse.json(
      { error: "productName is required" },
      { status: 400 }
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Build person description from pre-computed analysis
    let personDesc = "a fashion model";
    if (personAnalysis?.hair) {
      const parts = [
        personAnalysis.age_range,
        "person with a",
        personAnalysis.build ?? "average",
        "build,",
        personAnalysis.hair,
        "hair, and",
        personAnalysis.skin_tone ?? "medium",
        "skin tone",
      ].filter(Boolean);
      personDesc = `a ${parts.join(" ")}`;
    } else if (personAnalysis?.gender) {
      const parts = [];
      if (personAnalysis.gender) parts.push(personAnalysis.gender);
      if (personAnalysis.height_cm) parts.push(`${personAnalysis.height_cm}cm tall`);
      if (personAnalysis.weight_kg) parts.push(`${personAnalysis.weight_kg}kg`);
      if (personAnalysis.fit_preference) parts.push(`${personAnalysis.fit_preference} fit preference`);
      personDesc = parts.length > 0 ? `a ${parts.join(", ")} person` : "a fashion model";
    }

    // Build garment description from pre-computed analysis
    let garmentDesc = productName;
    if (productAnalysis) {
      garmentDesc = `${productAnalysis.color ?? ""} ${productAnalysis.garment_type ?? productName}`.trim();
      if (productAnalysis.fabric) garmentDesc += ` made of ${productAnalysis.fabric}`;
      if (productAnalysis.pattern && productAnalysis.pattern !== "solid") garmentDesc += `, ${productAnalysis.pattern} pattern`;
      if (productAnalysis.details) garmentDesc += ` with ${productAnalysis.details}`;
    }

    const styleNote = productAnalysis?.style ? ` The overall aesthetic is ${productAnalysis.style}.` : "";

    const prompt = `${personDesc} wearing ${garmentDesc}.${styleNote} Clean studio backdrop, soft professional lighting, the model slowly turns to show the garment from all angles. Cinematic, high quality fashion video.`;

    console.log("[Veo] Generated prompt:", prompt);

    const operation = await ai.models.generateVideos({
      model: "veo-3.1-fast-generate",
      prompt,
      config: {
        aspectRatio: "9:16",
      },
    });

    return NextResponse.json({
      operationName: operation.name,
      prompt,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error starting generation";
    console.error("Veo start error:", message, err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 501 }
    );
  }

  const opName = request.nextUrl.searchParams.get("op");
  if (!opName) {
    return NextResponse.json(
      { error: "op query param required" },
      { status: 400 }
    );
  }

  try {
    // Use REST API directly to avoid SDK _fromAPIResponse bug
    const pollRes = await fetch(`${BASE_URL}/${opName}`, {
      headers: { "x-goog-api-key": GEMINI_API_KEY },
    });

    if (!pollRes.ok) {
      const errText = await pollRes.text();
      console.error("Veo poll HTTP error:", pollRes.status, errText);
      return NextResponse.json(
        { error: `Poll failed: ${pollRes.status}` },
        { status: 502 }
      );
    }

    const opData = await pollRes.json();

    if (!opData.done) {
      return NextResponse.json({ done: false });
    }

    // Extract video URI from response
    const generatedSamples =
      opData.response?.generateVideoResponse?.generatedSamples ??
      opData.response?.generatedVideos ??
      [];

    const videoUri =
      generatedSamples[0]?.video?.uri ?? generatedSamples[0]?.uri;

    if (!videoUri) {
      console.error("No video URI in response:", JSON.stringify(opData.response));
      return NextResponse.json(
        { done: true, error: "No video in response" },
        { status: 502 }
      );
    }

    // Download video via URI with API key
    const videoRes = await fetch(
      `${videoUri}${videoUri.includes("?") ? "&" : "?"}key=${GEMINI_API_KEY}&alt=media`
    );

    if (!videoRes.ok) {
      // Try alternate download: use the SDK files API
      try {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const downloadResult = await ai.files.download({
          file: { uri: videoUri },
        });
        const resp = downloadResult as Response;
        if (typeof resp.arrayBuffer === "function") {
          const buffer = Buffer.from(await resp.arrayBuffer());
          const storageUrl = await uploadToStorage(buffer);
          return NextResponse.json({
            done: true,
            videoUrl: `data:video/mp4;base64,${buffer.toString("base64")}`,
            storageUrl,
          });
        }
      } catch (dlErr) {
        console.error("SDK download fallback failed:", dlErr);
      }

      return NextResponse.json(
        { done: true, error: "Failed to download video" },
        { status: 502 }
      );
    }

    const buffer = Buffer.from(await videoRes.arrayBuffer());
    const storageUrl = await uploadToStorage(buffer);
    return NextResponse.json({
      done: true,
      videoUrl: `data:video/mp4;base64,${buffer.toString("base64")}`,
      storageUrl,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error polling video";
    console.error("Veo poll error:", message, err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
