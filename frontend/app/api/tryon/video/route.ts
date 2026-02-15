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

interface ProductAnalysis {
  color: string;
  garment_type: string;
  style: string;
  fabric: string;
  details: string;
}

interface PersonAnalysis {
  ethnicity: string;
  build: string;
  hair: string;
  age_range: string;
  skin_tone: string;
}

/** Use Gemini to analyze an image and return structured JSON. */
async function analyzeImage(
  ai: GoogleGenAI,
  imageUrl: string,
  systemPrompt: string
): Promise<Record<string, string> | null> {
  try {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            {
              fileData: { mimeType: "image/jpeg", fileUri: imageUrl },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });
    const text = res.text ?? "";
    return JSON.parse(text);
  } catch (err) {
    console.error("Image analysis failed:", err);
    return null;
  }
}

/**
 * POST — Analyze product & person images, then start Veo video generation.
 * GET  — Poll status by operation name.
 */

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 501 }
    );
  }

  const { productImageUrl, productName, personPhotoUrl, personInfo } = await request.json();

  if (!productImageUrl) {
    return NextResponse.json(
      { error: "productImageUrl is required" },
      { status: 400 }
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Analyze product image for color, style, fabric
    const productAnalysis = await analyzeImage(
      ai,
      productImageUrl,
      `Analyze this clothing product image. Return JSON with these exact keys:
- "color": the primary color(s) of the garment (e.g. "navy blue", "black with white stripes")
- "garment_type": what type of clothing (e.g. "slim-fit jeans", "oversized hoodie", "midi dress")
- "style": the style/vibe (e.g. "streetwear", "formal", "casual", "athleisure")
- "fabric": the apparent fabric/material (e.g. "denim", "cotton", "silk", "leather")
- "details": notable design details (e.g. "distressed knees, silver buttons", "pleated front")`
    );

    // Analyze person photo if available
    let personAnalysis: Record<string, string> | null = null;
    if (personPhotoUrl) {
      personAnalysis = await analyzeImage(
        ai,
        personPhotoUrl,
        `Analyze this person's appearance for a fashion try-on video. Return JSON with these exact keys:
- "ethnicity": apparent ethnicity/background
- "build": body build (e.g. "slim", "athletic", "average", "curvy")
- "hair": hair description (color, length, style)
- "age_range": approximate age range (e.g. "early 20s", "mid 30s")
- "skin_tone": skin tone description (e.g. "fair", "olive", "medium brown", "deep")`
      );
    }

    // Build rich prompt
    const product = productAnalysis as ProductAnalysis | null;
    const person = personAnalysis as PersonAnalysis | null;

    let personDesc = "a fashion model";
    if (person) {
      personDesc = `a ${person.age_range ?? ""} ${person.ethnicity ?? ""} person with a ${person.build ?? "average"} build, ${person.hair ?? ""} hair, and ${person.skin_tone ?? "medium"} skin tone`.replace(/\s+/g, " ").trim();
    } else if (personInfo) {
      // Fall back to user preferences if no photo
      const parts = [];
      if (personInfo.gender) parts.push(personInfo.gender);
      if (personInfo.height_cm) parts.push(`${personInfo.height_cm}cm tall`);
      if (personInfo.weight_kg) parts.push(`${personInfo.weight_kg}kg`);
      if (personInfo.fit_preference) parts.push(`${personInfo.fit_preference} fit preference`);
      personDesc = parts.length > 0 ? `a ${parts.join(", ")} person` : "a fashion model";
    }

    let garmentDesc = productName;
    if (product) {
      garmentDesc = `${product.color ?? ""} ${product.garment_type ?? productName}`.trim();
      if (product.fabric) garmentDesc += ` made of ${product.fabric}`;
      if (product.details) garmentDesc += ` with ${product.details}`;
    }

    const styleNote = product?.style ? ` The overall aesthetic is ${product.style}.` : "";

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
      productAnalysis: product,
      personAnalysis: person,
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
