"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { useRef, useEffect, useState, Suspense, useMemo } from "react";
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

// ── MannequinModel (mannequin-js) ────────────────────────────────────────────

interface MannequinModelProps {
  product?: Product | null;
}

function MannequinModel({ product }: MannequinModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mannequinRef = useRef<any>(null);
  const [mannequin, setMannequin] = useState<THREE.Object3D | null>(null);

  const baseMaterials = useMemo(
    () => ({
      skin: new THREE.MeshStandardMaterial({ color: "#d4a574", roughness: 0.6, metalness: 0.05 }),
      shirt: new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.7, metalness: 0 }),
      pants: new THREE.MeshStandardMaterial({ color: "#2d2d3d", roughness: 0.7, metalness: 0 }),
      shoes: new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.6, metalness: 0.05 }),
    }),
    []
  );

  // Create mannequin once
  useEffect(() => {
    let cancelled = false;

    // mannequin-js auto-creates a renderer/scene/dom element on import.
    // We need to capture and clean those up after extracting the model.
    import("mannequin-js/src/mannequin.js")
      .then((mod) => {
        if (cancelled) return;
        const { Male, getStage } = mod;
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

        // Detach from mannequin-js's internal scene
        man.removeFromParent();

        // Clean up mannequin-js's auto-created renderer + DOM elements
        try {
          const stage = getStage();
          if (stage?.renderer) {
            stage.renderer.setAnimationLoop(null);
            if (stage.renderer.domElement?.parentNode) {
              stage.renderer.domElement.parentNode.removeChild(stage.renderer.domElement);
            }
            stage.renderer.dispose();
          }
        } catch {
          // ignore cleanup errors
        }

        // Remove any stray elements mannequin-js appended
        document.querySelectorAll('canvas').forEach((c) => {
          if (c.style.position === 'fixed' && !c.closest('.mannequin-container')) {
            c.remove();
          }
        });

        mannequinRef.current = man;
        setMannequin(man);
      })
      .catch((err) => {
        console.error("[MannequinViewer] Failed to load mannequin-js:", err);
      });

    return () => { cancelled = true; };
  }, []);

  // Apply product clothing colors
  useEffect(() => {
    const man = mannequinRef.current;
    if (!man) return;

    // Reset to defaults
    applyMaterialToPart(man.torso, baseMaterials.shirt);
    if (man.l_arm) applyMaterialToPart(man.l_arm, baseMaterials.shirt);
    if (man.r_arm) applyMaterialToPart(man.r_arm, baseMaterials.shirt);
    applyMaterialToPart(man.pelvis, baseMaterials.pants);
    if (man.l_leg) applyMaterialToPart(man.l_leg, baseMaterials.pants);
    if (man.r_leg) applyMaterialToPart(man.r_leg, baseMaterials.pants);
    if (man.l_ankle) applyMaterialToPart(man.l_ankle, baseMaterials.shoes);
    if (man.r_ankle) applyMaterialToPart(man.r_ankle, baseMaterials.shoes);

    if (!product?.image_url || !product.category) return;

    const zone = classifyZone(product.category);
    if (zone === "none") return;

    (async () => {
      const color = await extractDominantColor(product.image_url!);
      const clothingMat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0 });

      if (zone === "top" || zone === "full") {
        applyMaterialToPart(man.torso, clothingMat);
        if (man.l_arm) applyMaterialToPart(man.l_arm, clothingMat);
        if (man.r_arm) applyMaterialToPart(man.r_arm, clothingMat);
      }

      if (zone === "bottom" || zone === "full") {
        applyMaterialToPart(man.pelvis, clothingMat);
        if (man.l_leg) applyMaterialToPart(man.l_leg, clothingMat);
        if (man.r_leg) applyMaterialToPart(man.r_leg, clothingMat);
        if (man.l_knee) applyMaterialToPart(man.l_knee, clothingMat);
        if (man.r_knee) applyMaterialToPart(man.r_knee, clothingMat);
      }

      if (zone === "shoes") {
        const shoeMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05 });
        if (man.l_ankle) applyMaterialToPart(man.l_ankle, shoeMat);
        if (man.r_ankle) applyMaterialToPart(man.r_ankle, shoeMat);
      }
    })();
  }, [product, mannequin, baseMaterials]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
    }
  });

  if (!mannequin) return null;

  return (
    <group ref={groupRef} scale={[1.1, 1.1, 1.1]}>
      <primitive object={mannequin} />
    </group>
  );
}

// ── Scene ────────────────────────────────────────────────────────────────────

function Scene({ product }: { product?: Product | null }) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 5]} intensity={1.5} castShadow />
      <directionalLight position={[-3, 4, -2]} intensity={0.4} />
      <pointLight position={[0, 6, 3]} intensity={0.8} />
      <hemisphereLight args={["#ffffff", "#444444", 0.6]} />

      <MannequinModel product={product} />

      <ContactShadows position={[0, -0.71, 0]} opacity={0.4} scale={8} blur={2} far={4} />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.8}
        autoRotate
        autoRotateSpeed={1}
      />
    </>
  );
}

// ── Exported component ───────────────────────────────────────────────────────

interface MannequinViewerProps {
  product?: Product | null;
}

export function MannequinViewer({ product }: MannequinViewerProps) {
  return (
    <div className="mannequin-container h-full w-full">
      <Canvas
        camera={{ position: [0, 0.8, 3], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Scene product={product} />
        </Suspense>
      </Canvas>
    </div>
  );
}
