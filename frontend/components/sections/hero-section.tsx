"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const word = "thread";

const sideImages = [
  {
    src: "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800&h=1200&fit=crop",
    alt: "Fashion editorial with denim",
    position: "left",
    span: 1,
  },
  {
    src: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&h=1200&fit=crop",
    alt: "Curated outfit display",
    position: "left",
    span: 1,
  },
  {
    src: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&h=1200&fit=crop",
    alt: "Street style fashion",
    position: "right",
    span: 1,
  },
  {
    src: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&h=1200&fit=crop",
    alt: "Fashion runway look",
    position: "right",
    span: 1,
  },
];

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const scrollableHeight = window.innerHeight * 2;
      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / scrollableHeight));

      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Text fades out (0 to 0.3)
  const textOpacity = Math.max(0, 1 - (scrollProgress / 0.3));

  // Image transforms start after text fades (0.2 to 1)
  const imageProgress = Math.max(0, Math.min(1, (scrollProgress - 0.2) / 0.8));

  // Smooth interpolations
  const centerWidth = 100 - (imageProgress * 80);
  const sideWidth = imageProgress * 40;
  const sideOpacity = imageProgress;
  const sideTranslateLeft = -100 + (imageProgress * 100);
  const sideTranslateRight = 100 - (imageProgress * 100);
  const gap = imageProgress * 8;
  const sideTranslateY = -(imageProgress * 15);

  return (
    <section ref={sectionRef} className="relative bg-background">
      {/* Sticky container for scroll animation */}
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Bento Grid Container */}
        <div
          className="absolute inset-0 flex items-stretch"
          style={{ gap: `${gap}px` }}
        >

          {/* Left Column */}
          <div
            className="flex flex-row will-change-transform"
            style={{
              width: `${sideWidth}%`,
              gap: `${gap}px`,
              transform: `translateX(${sideTranslateLeft}%) translateY(${sideTranslateY}%)`,
              opacity: sideOpacity,
            }}
          >
            {sideImages.filter(img => img.position === "left").map((img, idx) => (
              <div
                key={idx}
                className="relative flex-1 overflow-hidden will-change-transform"
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="(max-width: 768px) 50vw, 20vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>

          {/* Main Hero Image - Center */}
          <div
            className="relative overflow-hidden will-change-transform"
            style={{
              width: `${centerWidth}%`,
              flex: "0 0 auto",
            }}
          >
            {/* Background image */}
            <Image
              src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&h=1200&fit=crop"
              alt="Fashion store with curated collections"
              fill
              className="object-cover"
              priority
            />

            {/* Dark overlay for text contrast */}
            <div className="absolute inset-0 bg-black/30" />

            {/* Big "thread" text - on TOP of image, fades with scroll */}
            <div
              className="absolute inset-0 z-20 flex items-center justify-center"
              style={{ opacity: textOpacity }}
            >
              <h1 className="whitespace-nowrap text-[28vw] font-black leading-[0.85] tracking-tighter text-white lowercase">
                {word.split("").map((letter, index) => (
                  <span
                    key={index}
                    className="inline-block animate-[slideUp_0.8s_ease-out_forwards] opacity-0"
                    style={{
                      animationDelay: `${index * 0.08}s`,
                      transition: 'all 1.5s',
                      transitionTimingFunction: 'cubic-bezier(0.86, 0, 0.07, 1)',
                      textShadow: '0 4px 30px rgba(0,0,0,0.3)',
                    }}
                  >
                    {letter}
                  </span>
                ))}
              </h1>
            </div>
          </div>

          {/* Right Column */}
          <div
            className="flex flex-row will-change-transform"
            style={{
              width: `${sideWidth}%`,
              gap: `${gap}px`,
              transform: `translateX(${sideTranslateRight}%) translateY(${sideTranslateY}%)`,
              opacity: sideOpacity,
            }}
          >
            {sideImages.filter(img => img.position === "right").map((img, idx) => (
              <div
                key={idx}
                className="relative flex-1 overflow-hidden will-change-transform"
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="(max-width: 768px) 50vw, 20vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Tagline Section - Fixed at bottom */}
      <div
        className="pointer-events-none fixed bottom-0 left-0 right-0 z-10 px-6 pb-12 md:px-12 md:pb-16 lg:px-20 lg:pb-20"
        style={{ opacity: textOpacity }}
      >
        <p className="mx-auto max-w-2xl text-center text-2xl leading-relaxed text-white md:text-3xl lg:text-[2.5rem] lg:leading-snug drop-shadow-lg">
          Search. Discover.
          <br />
          Wear it your way.
        </p>
      </div>

      {/* Scroll space to enable animation */}
      <div className="h-[200vh]" />
    </section>
  );
}
