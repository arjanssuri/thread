"use client";

import Image from "next/image";
import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Upload, X, Sparkles, Camera, RotateCcw } from "lucide-react";
import type { Product } from "@/types/product";

const MannequinViewer = dynamic(
  () =>
    import("@/components/mannequin-viewer").then((mod) => mod.MannequinViewer),
  { ssr: false }
);

interface TryOnPanelProps {
  product: Product | null;
  onClose: () => void;
}

export function TryOnPanel({ product, onClose }: TryOnPanelProps) {
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"mannequin" | "tryon">("mannequin");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!product) return null;

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUserPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleGenerate() {
    if (!userPhoto || !product) return;
    setGenerating(true);
    setGeneratedImage(null);

    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPhoto,
          productImageUrl: product.image_url,
          productName: product.name,
        }),
      });

      if (!res.ok) throw new Error("Generation failed");

      const data = await res.json();
      setGeneratedImage(data.imageUrl);
    } catch {
      console.error("Try-on generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const allImages: string[] = [
    product.image_url,
    ...((product.metadata?.all_images as string[]) ?? []),
  ].filter((url): url is string => !!url);

  // Deduplicate
  const uniqueImages = [...new Set(allImages)].slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {product.brand}
            </p>
            <h2 className="text-lg font-semibold text-foreground">
              {product.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-secondary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Product images */}
          <div className="grid grid-cols-2 gap-1 p-1">
            {uniqueImages.map((url, i) => (
              <div
                key={i}
                className="relative aspect-[3/4] bg-secondary overflow-hidden"
              >
                <Image
                  src={url}
                  alt={`${product.name} view ${i + 1}`}
                  fill
                  className="object-cover"
                  sizes="300px"
                />
              </div>
            ))}
          </div>

          {/* Product details */}
          <div className="px-6 py-5">
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-semibold">
                {product.price != null ? `$${product.price.toFixed(2)}` : ""}
              </p>
              <p className="text-sm text-muted-foreground capitalize">
                {product.category}
              </p>
            </div>

            {product.description && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                {product.description}
              </p>
            )}
          </div>

          {/* Tab switcher */}
          <div className="mx-6 flex rounded-full bg-secondary p-1">
            <button
              onClick={() => setActiveTab("mannequin")}
              className={`flex-1 rounded-full py-2.5 text-sm font-medium transition-all ${
                activeTab === "mannequin"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <RotateCcw size={14} className="inline mr-1.5 -mt-0.5" />
              3D View
            </button>
            <button
              onClick={() => setActiveTab("tryon")}
              className={`flex-1 rounded-full py-2.5 text-sm font-medium transition-all ${
                activeTab === "tryon"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles size={14} className="inline mr-1.5 -mt-0.5" />
              AI Try-On
            </button>
          </div>

          {/* Tab content */}
          <div className="px-6 py-5">
            {activeTab === "mannequin" ? (
              <div className="relative h-[400px] rounded-xl bg-secondary overflow-hidden">
                <MannequinViewer />
                <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-muted-foreground">
                  Drag to rotate
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Upload area */}
                {!userPhoto ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border py-12 transition-colors hover:border-foreground/30 hover:bg-secondary/50"
                  >
                    <div className="rounded-full bg-secondary p-4">
                      <Upload size={24} className="text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Upload your photo</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Full-body photo works best
                      </p>
                    </div>
                  </button>
                ) : (
                  <div className="relative">
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-secondary">
                      {generatedImage ? (
                        <Image
                          src={generatedImage}
                          alt="AI try-on result"
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <Image
                          src={userPhoto}
                          alt="Your photo"
                          fill
                          className="object-cover"
                        />
                      )}
                      {generating && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <p className="mt-3 text-sm font-medium text-white">
                            Generating try-on...
                          </p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setUserPhoto(null);
                        setGeneratedImage(null);
                      }}
                      className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />

                {/* Generate / Re-upload buttons */}
                <div className="flex gap-3">
                  {userPhoto && !generatedImage && (
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="flex-1 flex items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-50"
                    >
                      <Sparkles size={16} />
                      {generating ? "Generating..." : "Try it on"}
                    </button>
                  )}
                  {generatedImage && (
                    <>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 flex items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-medium transition-colors hover:bg-secondary"
                      >
                        <Camera size={16} />
                        New photo
                      </button>
                      <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="flex-1 flex items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-semibold text-background transition-opacity hover:opacity-80"
                      >
                        <Sparkles size={16} />
                        Regenerate
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
