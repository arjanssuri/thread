"use client";

import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import type { Product } from "@/types/product";

// ── Helpers ──────────────────────────────────────────────────────────────────

function classifyZone(
  category: string | null | undefined
): "top" | "bottom" | "shoes" | "full" | "none" {
  const c = (category ?? "").toLowerCase();
  if (/dress|gown|jumpsuit|romper|onesie|bodysuit/i.test(c)) return "full";
  if (/shoe|sneaker|boot|sandal|slipper|clog|flat|heel|loafer|mule|footwear/i.test(c)) return "shoes";
  if (/pant|jean|trouser|short|legging|jogger|skirt|bottom/i.test(c)) return "bottom";
  if (/top|shirt|tee|blouse|sweater|hoodie|jacket|coat|vest|tank|polo|knit|pullover|crew|henley|cardigan|fleece|sweatshirt|longsleeve|shortsleeve/i.test(c)) return "top";
  return "none";
}

function extractDominantColor(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 32;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;

      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const brightness = data[i] + data[i + 1] + data[i + 2];
        if (brightness > 60 && brightness < 700) {
          r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
        }
      }
      if (count === 0) { resolve("#444444"); return; }
      r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
      resolve(`#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`);
    };
    img.onerror = () => resolve("#444444");
    img.src = url;
  });
}

function applyMaterialToPart(part: THREE.Object3D, material: THREE.Material) {
  part.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = material;
    }
  });
}

// ── Default materials ────────────────────────────────────────────────────────

const DEFAULT_SHIRT = new THREE.MeshPhongMaterial({ color: "#1a1a1a", shininess: 10 });
const DEFAULT_PANTS = new THREE.MeshPhongMaterial({ color: "#2d2d3d", shininess: 10 });
const DEFAULT_SHOES = new THREE.MeshPhongMaterial({ color: "#111111", shininess: 20 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resetMannequin(man: any) {
  applyMaterialToPart(man.torso, DEFAULT_SHIRT);
  if (man.l_arm) applyMaterialToPart(man.l_arm, DEFAULT_SHIRT);
  if (man.r_arm) applyMaterialToPart(man.r_arm, DEFAULT_SHIRT);
  if (man.l_elbow) applyMaterialToPart(man.l_elbow, DEFAULT_SHIRT);
  if (man.r_elbow) applyMaterialToPart(man.r_elbow, DEFAULT_SHIRT);
  applyMaterialToPart(man.pelvis, DEFAULT_PANTS);
  if (man.l_leg) applyMaterialToPart(man.l_leg, DEFAULT_PANTS);
  if (man.r_leg) applyMaterialToPart(man.r_leg, DEFAULT_PANTS);
  if (man.l_knee) applyMaterialToPart(man.l_knee, DEFAULT_PANTS);
  if (man.r_knee) applyMaterialToPart(man.r_knee, DEFAULT_PANTS);
  if (man.l_ankle) applyMaterialToPart(man.l_ankle, DEFAULT_SHOES);
  if (man.r_ankle) applyMaterialToPart(man.r_ankle, DEFAULT_SHOES);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyClothing(man: any, product: Product | null | undefined) {
  resetMannequin(man);

  if (!product?.image_url || !product.category) return;

  const zone = classifyZone(product.category);
  if (zone === "none") return;

  const color = await extractDominantColor(product.image_url);
  const clothingMat = new THREE.MeshPhongMaterial({ color, shininess: 15 });

  if (zone === "top" || zone === "full") {
    applyMaterialToPart(man.torso, clothingMat);
    if (man.l_arm) applyMaterialToPart(man.l_arm, clothingMat);
    if (man.r_arm) applyMaterialToPart(man.r_arm, clothingMat);
    if (man.l_elbow) applyMaterialToPart(man.l_elbow, clothingMat);
    if (man.r_elbow) applyMaterialToPart(man.r_elbow, clothingMat);
  }

  if (zone === "bottom" || zone === "full") {
    applyMaterialToPart(man.pelvis, clothingMat);
    if (man.l_leg) applyMaterialToPart(man.l_leg, clothingMat);
    if (man.r_leg) applyMaterialToPart(man.r_leg, clothingMat);
    if (man.l_knee) applyMaterialToPart(man.l_knee, clothingMat);
    if (man.r_knee) applyMaterialToPart(man.r_knee, clothingMat);
  }

  if (zone === "shoes") {
    const shoeMat = new THREE.MeshPhongMaterial({ color, shininess: 30 });
    if (man.l_ankle) applyMaterialToPart(man.l_ankle, shoeMat);
    if (man.r_ankle) applyMaterialToPart(man.r_ankle, shoeMat);
  }
}

// ── MannequinViewer ──────────────────────────────────────────────────────────

interface MannequinViewerProps {
  product?: Product | null;
}

export function MannequinViewer({ product }: MannequinViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mannequinRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stageRef = useRef<any>(null);
  const initRef = useRef(false);
  // Track when mannequin is ready so the clothing effect can fire
  const [ready, setReady] = useState(false);

  // Initialize mannequin-js once
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const container = containerRef.current;
    if (!container) return;

    import("mannequin-js/src/mannequin.js")
      .then((mod) => {
        const { Male, getStage } = mod;
        const stage = getStage();
        stageRef.current = stage;

        if (!stage?.renderer) return;

        // Steal the canvas from document.body into our container
        const canvas = stage.renderer.domElement;
        canvas.style.cssText = "width:100%; height:100%; position:absolute; top:0; left:0; border-radius: inherit;";
        container.appendChild(canvas);

        // Transparent background
        stage.scene.background = null;
        stage.renderer.setClearColor(0x000000, 0);

        // Resize to container
        const rect = container.getBoundingClientRect();
        stage.renderer.setSize(rect.width, rect.height);
        stage.camera.aspect = rect.width / rect.height;
        stage.camera.position.set(0, 0, 4.5);
        stage.camera.updateProjectionMatrix();

        // Create mannequin
        const man = new Male();

        // Natural pose
        man.torso.bend = 2;
        man.head.nod = -5;
        man.l_arm.raise = -5;
        man.r_arm.raise = -5;
        man.l_arm.straddle = 8;
        man.r_arm.straddle = 8;
        man.l_elbow.bend = 15;
        man.r_elbow.bend = 15;

        mannequinRef.current = man;
        setReady(true); // triggers the clothing effect below
      })
      .catch((err) => {
        console.error("[MannequinViewer] Failed to load mannequin-js:", err);
      });

    // Keep renderer sized to container
    const resizeObserver = new ResizeObserver((entries) => {
      const stage = stageRef.current;
      if (!stage?.renderer) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        stage.renderer.setSize(width, height);
        stage.camera.aspect = width / height;
        stage.camera.updateProjectionMatrix();
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Apply product clothing — fires when product changes OR when mannequin becomes ready
  useEffect(() => {
    if (!ready) return;
    const man = mannequinRef.current;
    if (!man) return;
    applyClothing(man, product);
  }, [product, ready]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative overflow-hidden"
      style={{ minHeight: 300 }}
    />
  );
}
