import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

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

  const { productName, productCategory, productImageUrl, productAnalysis, personAnalysis, personPhotoUrl, gender } = await request.json();

  if (!productName) {
    return NextResponse.json(
      { error: "productName is required" },
      { status: 400 }
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Determine the product zone for camera direction
    const garmentType = (productAnalysis?.garment_type ?? productName).toLowerCase();
    const category = (productCategory ?? "").toLowerCase();
    const isBottoms = /pant|jean|trouser|short|skirt|legging|jogger|chino|cargo/i.test(garmentType + " " + category);
    const isFootwear = /shoe|sneaker|boot|sandal|heel|loafer|slipper/i.test(garmentType + " " + category);
    const isFullBody = /dress|jumpsuit|romper|suit|onesie|overalls/i.test(garmentType + " " + category);

    // Resolve gender from explicit param, person analysis, or default
    const resolvedGender = gender || personAnalysis?.gender || null;

    // Build person description from pre-computed analysis
    let personDesc = resolvedGender ? `a ${resolvedGender} fashion model` : "a fashion model";
    if (personAnalysis?.hair) {
      const parts = [
        personAnalysis.age_range,
        resolvedGender ?? "",
        "person with a",
        personAnalysis.build ?? "average",
        "build,",
        personAnalysis.hair,
        "hair, and",
        personAnalysis.skin_tone ?? "medium",
        "skin tone",
      ].filter(Boolean);
      personDesc = `a ${parts.join(" ")}`;
    } else if (resolvedGender || personAnalysis?.height_cm) {
      const parts = [];
      if (resolvedGender) parts.push(resolvedGender);
      if (personAnalysis?.height_cm) parts.push(`${personAnalysis.height_cm}cm tall`);
      if (personAnalysis?.weight_kg) parts.push(`${personAnalysis.weight_kg}kg`);
      if (personAnalysis?.fit_preference) parts.push(`${personAnalysis.fit_preference} fit preference`);
      personDesc = parts.length > 0 ? `a ${parts.join(", ")} person` : personDesc;
    }

    // Fetch person photo and product image in parallel for reference images
    const fetchImageBase64 = async (url: string, label: string): Promise<string | null> => {
      try {
        console.log(`[Veo] Fetching ${label}:`, url);
        const res = await fetch(url);
        if (!res.ok) {
          console.error(`[Veo] ${label} fetch failed: ${res.status} ${res.statusText}`);
          return null;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        console.log(`[Veo] ${label} fetched: ${buf.length} bytes`);
        return buf.toString("base64");
      } catch (err) {
        console.error(`[Veo] Failed to fetch ${label}:`, err);
        return null;
      }
    };

    const [personImageBase64, productImageBase64] = await Promise.all([
      personPhotoUrl ? fetchImageBase64(personPhotoUrl, "person photo") : Promise.resolve(null),
      productImageUrl ? fetchImageBase64(productImageUrl, "product image") : Promise.resolve(null),
    ]);

    // Build garment description — emphasize the product-specific features
    let garmentDesc = productName;
    if (productAnalysis) {
      garmentDesc = `${productAnalysis.color ?? ""} ${productAnalysis.garment_type ?? productName}`.trim();
      if (productAnalysis.fabric) garmentDesc += ` made of ${productAnalysis.fabric}`;
      if (productAnalysis.fit) garmentDesc += `, ${productAnalysis.fit}`;
      if (productAnalysis.pattern && productAnalysis.pattern !== "solid") garmentDesc += `, ${productAnalysis.pattern} pattern`;
      if (productAnalysis.details) garmentDesc += ` with ${productAnalysis.details}`;
    }

    const styleNote = productAnalysis?.style ? ` The overall aesthetic is ${productAnalysis.style}.` : "";

    // Product-specific emphasis (what to draw attention to) while keeping consistent framing
    let productEmphasis: string;
    if (isBottoms) {
      productEmphasis = `Draw attention to the ${garmentType}: the waistband, the fit through the thigh, the leg silhouette, and the hem.`;
    } else if (isFootwear) {
      productEmphasis = `Draw attention to the footwear: the shape, material, and how they complete the outfit.`;
    } else if (isFullBody) {
      productEmphasis = `Draw attention to how the garment drapes and flows, the waistline, neckline, and hemline.`;
    } else {
      productEmphasis = `Draw attention to the ${garmentType}: the fit, the neckline, sleeves, and overall drape.`;
    }

    let referenceNote = "";
    if (personImageBase64 && productImageBase64) {
      referenceNote = ` TWO reference images are provided. Reference image 1 is a PHOTO OF THE PERSON — use this person's exact face, hair, skin tone, and body as the model in the video. Do NOT use the person shown in reference image 2. Reference image 2 is a PRODUCT PHOTO of the clothing item — use ONLY the garment (its color, fabric, pattern, and design) from this image. IGNORE the model/mannequin wearing it in that photo. The video must show the person from reference image 1 wearing the garment from reference image 2.`;
    } else if (personImageBase64) {
      referenceNote = ` A reference image of the person is provided — the video must depict this exact person's face, body, hair, and skin tone.`;
    } else if (productImageBase64) {
      referenceNote = ` A reference image of the garment is provided — match its exact color, fabric, pattern, and details. IGNORE the person/mannequin in the product photo.`;
    }

    const prompt = `Full-body fashion video of ${personDesc} wearing ${garmentDesc}.${referenceNote} IMPORTANT: The entire person must be visible from head to shoes/feet at all times — never crop any body part.${styleNote} Clean white studio backdrop, soft even professional lighting. Fixed wide-angle camera at waist height, centered. The model stands facing camera, then does a slow 360-degree turn in place. ${productEmphasis} Cinematic, high quality, 4K fashion video.`;

    console.log("[Veo] Generated prompt:", prompt);
    console.log("[Veo] Reference images — person:", !!personImageBase64, "product:", !!productImageBase64);

    // Build reference images array (person + product, up to 3 ASSET refs supported)
    const referenceImages: { image: { imageBytes: string; mimeType: string }; referenceType: "ASSET" }[] = [];
    if (personImageBase64) {
      referenceImages.push({
        image: { imageBytes: personImageBase64, mimeType: "image/jpeg" },
        referenceType: "ASSET",
      });
    }
    if (productImageBase64) {
      referenceImages.push({
        image: { imageBytes: productImageBase64, mimeType: "image/jpeg" },
        referenceType: "ASSET",
      });
    }

    // Use full veo-3.1 when we have reference images (fast preview doesn't support them)
    const model = referenceImages.length > 0
      ? "veo-3.1-generate-preview"
      : "veo-3.1-fast-generate-preview";

    console.log(`[Veo] Using model: ${model}, referenceImages: ${referenceImages.length}`);

    const operation = await ai.models.generateVideos({
      model,
      prompt,
      config: {
        aspectRatio: "9:16",
        personGeneration: "allow_adult",
        ...(referenceImages.length > 0 ? { referenceImages } : {}),
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
          if (storageUrl) {
            return NextResponse.json({ done: true, videoUrl: storageUrl, storageUrl });
          }
          return NextResponse.json(
            { done: true, error: "Failed to upload video to storage" },
            { status: 502 }
          );
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
    if (storageUrl) {
      return NextResponse.json({ done: true, videoUrl: storageUrl, storageUrl });
    }
    // Fallback: return error instead of base64 (too large for serverless response)
    return NextResponse.json(
      { done: true, error: "Failed to upload video to storage" },
      { status: 502 }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error polling video";
    console.error("Veo poll error:", message, err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
