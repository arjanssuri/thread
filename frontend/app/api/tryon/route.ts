import { NextRequest, NextResponse } from "next/server";

/**
 * Virtual try-on endpoint using OpenAI's image generation.
 *
 * Expects: { userPhoto: string (base64), productImageUrl: string, productName: string }
 * Returns: { imageUrl: string }
 *
 * To enable: set OPENAI_API_KEY in your environment variables.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OpenAI API key not configured. Add OPENAI_API_KEY to your environment.",
      },
      { status: 501 }
    );
  }

  const { userPhoto, productImageUrl, productName } = await request.json();

  if (!userPhoto || !productImageUrl) {
    return NextResponse.json(
      { error: "Missing userPhoto or productImageUrl" },
      { status: 400 }
    );
  }

  try {
    // Use GPT-4o / DALL-E for image editing to composite the product onto the user
    const response = await fetch(
      "https://api.openai.com/v1/images/edits",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: `Take this person's photo and realistically dress them in: ${productName}. The clothing item looks like the reference product image. Make it look natural and photorealistic. Keep the person's face, body shape, and pose the same. Only change their clothing to match the product.`,
          image: userPhoto,
          size: "1024x1536",
          quality: "high",
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      console.error("OpenAI error:", err);
      return NextResponse.json(
        { error: "Image generation failed" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;

    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("Try-on error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
