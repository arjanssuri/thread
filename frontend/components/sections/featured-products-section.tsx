"use client";

import { FadeImage } from "@/components/fade-image";

const features = [
  {
    image: "/images/4312e1bb-e030-4528-b6df-8a6ea69fe384.png",
    span: "col-span-2 row-span-2", // Large
  },
  {
    image: "/images/b2401fa5-4eac-465f-b1f9-014aadc182ee.png",
    span: "col-span-1 row-span-1", // Small
  },
  {
    image: "/images/dd1b32a8-3722-4ea2-8808-10d53532809d.png",
    span: "col-span-1 row-span-1", // Small
  },
  {
    image: "/images/61af06cc-84d0-4031-a0ed-76fc43b1c1e1.png",
    span: "col-span-1 row-span-2", // Tall
  },
  {
    image: "/images/249083d2-c49c-4c06-a125-376284d90c42.png",
    span: "col-span-1 row-span-1", // Small
  },
  {
    image: "/images/7638f650-8586-4403-8c13-141921a04f9d.png",
    span: "col-span-2 row-span-1", // Wide
  },
  {
    image: "/images/5b3bdb95-fac7-4d22-aa97-98b5d547b2db.png",
    span: "col-span-1 row-span-1", // Small
  },
  {
    image: "/images/634f7bae-77a5-49d0-a0ab-5271a6194e66.png",
    span: "col-span-1 row-span-2", // Tall
  },
  {
    image: "/images/09ffa8fd-cdd1-453f-9aa2-d6c702a1f4b5.png",
    span: "col-span-2 row-span-1", // Wide
  },
  {
    image: "/images/040e36b1-d16f-474b-a712-a9979e6ab479.png",
    span: "col-span-1 row-span-1", // Small
  },
];

export function FeaturedProductsSection() {
  return (
    <section id="technology" className="relative bg-background py-20 md:py-32">
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
                alt={`Architecture sketch ${index + 1}`}
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
