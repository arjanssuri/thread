"use client";

import { FadeImage } from "@/components/fade-image";

const features = [
  {
    image: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&h=800&fit=crop",
    span: "col-span-2 row-span-2", // Large
  },
  {
    image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=400&fit=crop",
    span: "col-span-1 row-span-1", // Small
  },
  {
    image: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=400&h=400&fit=crop",
    span: "col-span-1 row-span-1", // Small
  },
  {
    image: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=400&h=800&fit=crop",
    span: "col-span-1 row-span-2", // Tall
  },
  {
    image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&fit=crop",
    span: "col-span-1 row-span-1", // Small
  },
  {
    image: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&h=400&fit=crop",
    span: "col-span-2 row-span-1", // Wide
  },
  {
    image: "https://images.unsplash.com/photo-1560243563-062bfc001d68?w=400&h=400&fit=crop",
    span: "col-span-1 row-span-1", // Small
  },
  {
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=800&fit=crop",
    span: "col-span-1 row-span-2", // Tall
  },
  {
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=400&fit=crop",
    span: "col-span-2 row-span-1", // Wide
  },
  {
    image: "https://images.unsplash.com/photo-1467043237213-65f2da53396f?w=400&h=400&fit=crop",
    span: "col-span-1 row-span-1", // Small
  },
];

export function FeaturedProductsSection() {
  return (
    <section id="products" className="relative bg-background py-20 md:py-32">
      <div className="px-4 md:px-12 lg:px-20">
        {/* Bento Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full max-w-7xl mx-auto auto-rows-[180px] md:auto-rows-[220px]">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`relative overflow-hidden rounded-lg border border-gray-200 ${feature.span}`}
            >
              <FadeImage
                src={feature.image || "/placeholder.svg"}
                alt={`Fashion item ${index + 1}`}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
