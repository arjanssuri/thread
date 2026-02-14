"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { useRef, useEffect, useState, Suspense } from "react";
import * as THREE from "three";

function MannequinModel() {
  const groupRef = useRef<THREE.Group>(null);
  const [mannequin, setMannequin] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    let cancelled = false;

    import("mannequin-js/src/mannequin.js").then((mod) => {
      if (cancelled) return;

      const { Male, getStage } = mod;

      // Create the articulated mannequin figure
      const man = new Male();

      // Recolor: head, shoes, pelvis, joints, limbs, torso, nails
      man.recolor(
        "#d4a574", // head - skin
        "#111111", // shoes - black
        "#2d2d3d", // pelvis - dark pants
        "#444444", // joints
        "#d4a574", // limbs - skin
        "#1a1a1a", // torso - black shirt
        "#c4956a"  // nails
      );

      // Replace head texture with smooth plain material to remove uncanny face
      const smoothSkin = new THREE.MeshStandardMaterial({
        color: "#d4a574",
        roughness: 0.6,
        metalness: 0.05,
      });
      man.head.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.name === "HeadShape") {
          child.material = smoothSkin;
        }
      });

      // Set a natural standing pose
      man.torso.bend = 2;
      man.head.nod = -5;
      man.l_arm.raise = -5;
      man.r_arm.raise = -5;
      man.l_arm.straddle = 8;
      man.r_arm.straddle = 8;
      man.l_elbow.bend = 15;
      man.r_elbow.bend = 15;

      // Remove from mannequin-js internal scene
      man.removeFromParent();

      // Clean up mannequin-js renderer/canvas it creates
      const stage = getStage();
      if (stage?.renderer) {
        stage.renderer.setAnimationLoop(null);
        stage.renderer.dispose();
        if (stage.renderer.domElement?.parentNode) {
          stage.renderer.domElement.remove();
        }
      }

      setMannequin(man);
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

function Scene() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 5]} intensity={1.5} castShadow />
      <directionalLight position={[-3, 4, -2]} intensity={0.4} />
      <pointLight position={[0, 6, 3]} intensity={0.8} />
      <hemisphereLight args={["#ffffff", "#444444", 0.6]} />

      <MannequinModel />

      <ContactShadows
        position={[0, -0.71, 0]}
        opacity={0.4}
        scale={8}
        blur={2}
        far={4}
      />

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

export function MannequinViewer() {
  return (
    <div className="h-full w-full">
      <Canvas
        camera={{ position: [0, 0.8, 3], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
