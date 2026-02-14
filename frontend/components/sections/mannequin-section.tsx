"use client";

import dynamic from "next/dynamic";

const MannequinViewer = dynamic(
  () => import("@/components/mannequin-viewer").then((mod) => mod.MannequinViewer),
  { ssr: false }
);

export function MannequinSection() {
  return (
    <section className="relative bg-background overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-12 md:py-32 lg:px-20">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
          {/* Text */}
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
              See it on you
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl">
              Pick any outfit and visualize it in 3D. Rotate, zoom, and see how it fits before you buy. Then let Sora put it on you with AI-generated try-on.
            </p>
            <div className="mt-8 flex gap-4">
              <a
                href="/outfit"
                className="rounded-full bg-foreground px-6 py-3 text-base font-semibold text-background transition-opacity hover:opacity-80"
              >
                Try it out
              </a>
            </div>
          </div>

          {/* 3D Mannequin */}
          <div className="relative h-[500px] md:h-[600px]">
            <MannequinViewer />
            <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-muted-foreground">
              Drag to rotate
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
