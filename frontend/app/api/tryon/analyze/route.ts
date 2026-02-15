import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * POST /api/tryon/analyze
 * Analyzes product image (dominant color via sharp + AI description via Gemini)
 * and optionally the person's photo. Returns structured JSON tags.
 * Run once when user selects a product on the try-on screen.
 */

async function extractDominantColor(imageUrl: string): Promise<string> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return "#444444";
    const buffer = Buffer.from(await res.arrayBuffer());
    const { dominant } = await sharp(buffer).resize(64, 64, { fit: "cover" }).stats();
    const r = Math.round(dominant.r);
    const g = Math.round(dominant.g);
    const b = Math.round(dominant.b);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch (err) {
    console.error("[analyze] Color extraction failed:", err);
    return "#444444";
  }
}

function colorToName(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r + g + b) / 3;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;

  if (brightness < 40) return "black";
  if (brightness > 220 && sat < 0.1) return "white";
  if (sat < 0.12) {
    if (brightness < 100) return "charcoal";
    if (brightness < 170) return "gray";
    return "light gray";
  }

  if (r > g && r > b) {
    if (g > 150 && b < 100) return "orange";
    if (g < 80 && b < 80) return "red";
    if (b > 150) return "pink";
    return "red";
  }
  if (g > r && g > b) {
    if (r > 150) return "olive";
    if (b > 150) return "teal";
    return "green";
  }
  if (b > r && b > g) {
    if (r < 80 && g < 80) return "navy";
    if (r > 100) return "purple";
    return "blue";
  }
  if (r > 180 && g > 150 && b < 100) return "gold";
  if (r > 150 && g < 80) return "burgundy";
  return "multicolor";
}

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 501 });
  }

  const { productImageUrl, productName, personPhotoUrl, personInfo } = await request.json();

  if (!productImageUrl) {
    return NextResponse.json({ error: "productImageUrl is required" }, { status: 400 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Run color extraction (sharp) and AI analysis (Gemini) in parallel
    const [dominantColorHex, productAiResult, personAiResult] = await Promise.all([
      // 1. Dominant color via sharp (fast, pixel-based)
      extractDominantColor(productImageUrl),

      // 2. Product AI analysis (style, fabric, details)
      (async () => {
        try {
          const res = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
              role: "user",
              parts: [
                {
                  text: `Analyze this clothing product image. Return JSON with these exact keys:
- "garment_type": what type of clothing (e.g. "slim-fit jeans", "oversized hoodie", "midi dress")
- "style": the style/vibe (e.g. "streetwear", "formal", "casual", "athleisure")
- "fabric": the apparent fabric/material (e.g. "denim", "cotton", "silk", "leather")
- "pattern": pattern if any (e.g. "solid", "striped", "plaid", "floral")
- "details": notable design details (e.g. "distressed knees, silver buttons", "pleated front")`,
                },
                { fileData: { mimeType: "image/jpeg", fileUri: productImageUrl } },
              ],
            }],
            config: { responseMimeType: "application/json" },
          });
          return JSON.parse(res.text ?? "{}");
        } catch (err) {
          console.error("[analyze] Product AI analysis failed:", err);
          return null;
        }
      })(),

      // 3. Person AI analysis (if photo available)
      personPhotoUrl
        ? (async () => {
            try {
              const res = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{
                  role: "user",
                  parts: [
                    {
                      text: `Analyze this person's appearance for a fashion try-on video. Return JSON with these exact keys:
- "build": body build (e.g. "slim", "athletic", "average", "curvy")
- "hair": hair description (color, length, style)
- "age_range": approximate age range (e.g. "early 20s", "mid 30s")
- "skin_tone": skin tone description (e.g. "fair", "olive", "medium brown", "deep")`,
                    },
                    { fileData: { mimeType: "image/jpeg", fileUri: personPhotoUrl } },
                  ],
                }],
                config: { responseMimeType: "application/json" },
              });
              return JSON.parse(res.text ?? "{}");
            } catch (err) {
              console.error("[analyze] Person AI analysis failed:", err);
              return null;
            }
          })()
        : Promise.resolve(null),
    ]);

    const colorName = colorToName(dominantColorHex);

    // Build the product analysis
    const productAnalysis = {
      color: colorName,
      color_hex: dominantColorHex,
      garment_type: productAiResult?.garment_type ?? productName,
      style: productAiResult?.style ?? null,
      fabric: productAiResult?.fabric ?? null,
      pattern: productAiResult?.pattern ?? null,
      details: productAiResult?.details ?? null,
    };

    // Build person analysis
    let personAnalysis = null;
    if (personAiResult) {
      personAnalysis = {
        build: personAiResult.build ?? null,
        hair: personAiResult.hair ?? null,
        age_range: personAiResult.age_range ?? null,
        skin_tone: personAiResult.skin_tone ?? null,
      };
    } else if (personInfo) {
      personAnalysis = {
        gender: personInfo.gender ?? null,
        height_cm: personInfo.height_cm ?? null,
        weight_kg: personInfo.weight_kg ?? null,
        fit_preference: personInfo.fit_preference ?? null,
      };
    }

    return NextResponse.json({
      product: productAnalysis,
      person: personAnalysis,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("[analyze]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
