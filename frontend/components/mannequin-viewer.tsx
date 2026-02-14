"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

function Mannequin() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    }
  });

  const skinColor = "#d4a574";
  const shirtColor = "#1a1a1a";
  const pantsColor = "#2d2d3d";
  const shoeColor = "#111111";

  const skinMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: skinColor,
    roughness: 0.7,
    metalness: 0.05,
  }), []);

  const shirtMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: shirtColor,
    roughness: 0.8,
    metalness: 0.0,
  }), []);

  const pantsMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: pantsColor,
    roughness: 0.85,
    metalness: 0.0,
  }), []);

  const shoeMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: shoeColor,
    roughness: 0.4,
    metalness: 0.1,
  }), []);

  return (
    <group ref={groupRef} position={[0, -2.8, 0]}>
      {/* Head */}
      <mesh position={[0, 4.55, 0]} material={skinMaterial}>
        <sphereGeometry args={[0.28, 32, 32]} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 4.2, 0]} material={skinMaterial}>
        <cylinderGeometry args={[0.1, 0.12, 0.15, 16]} />
      </mesh>

      {/* Torso - shirt */}
      <mesh position={[0, 3.55, 0]} material={shirtMaterial}>
        <capsuleGeometry args={[0.35, 0.9, 8, 16]} />
      </mesh>

      {/* Shoulders */}
      <mesh position={[0, 3.95, 0]} material={shirtMaterial}>
        <capsuleGeometry args={[0.15, 0.55, 8, 16]} />
        <meshStandardMaterial color={shirtColor} roughness={0.8} />
      </mesh>

      {/* Left Upper Arm */}
      <mesh position={[-0.5, 3.55, 0]} rotation={[0, 0, 0.15]} material={shirtMaterial}>
        <capsuleGeometry args={[0.1, 0.5, 8, 16]} />
      </mesh>

      {/* Left Forearm */}
      <mesh position={[-0.55, 2.9, 0.05]} rotation={[0.1, 0, 0.05]} material={skinMaterial}>
        <capsuleGeometry args={[0.08, 0.45, 8, 16]} />
      </mesh>

      {/* Right Upper Arm */}
      <mesh position={[0.5, 3.55, 0]} rotation={[0, 0, -0.15]} material={shirtMaterial}>
        <capsuleGeometry args={[0.1, 0.5, 8, 16]} />
      </mesh>

      {/* Right Forearm */}
      <mesh position={[0.55, 2.9, 0.05]} rotation={[0.1, 0, -0.05]} material={skinMaterial}>
        <capsuleGeometry args={[0.08, 0.45, 8, 16]} />
      </mesh>

      {/* Hips / Belt area */}
      <mesh position={[0, 2.85, 0]} material={pantsMaterial}>
        <capsuleGeometry args={[0.3, 0.15, 8, 16]} />
      </mesh>

      {/* Left Upper Leg */}
      <mesh position={[-0.18, 2.25, 0]} material={pantsMaterial}>
        <capsuleGeometry args={[0.13, 0.55, 8, 16]} />
      </mesh>

      {/* Left Lower Leg */}
      <mesh position={[-0.18, 1.5, 0]} material={pantsMaterial}>
        <capsuleGeometry args={[0.1, 0.55, 8, 16]} />
      </mesh>

      {/* Right Upper Leg */}
      <mesh position={[0.18, 2.25, 0]} material={pantsMaterial}>
        <capsuleGeometry args={[0.13, 0.55, 8, 16]} />
      </mesh>

      {/* Right Lower Leg */}
      <mesh position={[0.18, 1.5, 0]} material={pantsMaterial}>
        <capsuleGeometry args={[0.1, 0.55, 8, 16]} />
      </mesh>

      {/* Left Shoe */}
      <mesh position={[-0.18, 1.05, 0.06]} material={shoeMaterial}>
        <boxGeometry args={[0.18, 0.12, 0.32]} />
      </mesh>

      {/* Right Shoe */}
      <mesh position={[0.18, 1.05, 0.06]} material={shoeMaterial}>
        <boxGeometry args={[0.18, 0.12, 0.32]} />
      </mesh>
    </group>
  );
}

export function MannequinViewer() {
  return (
    <div className="h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 8, 5]} intensity={1} castShadow />
        <directionalLight position={[-3, 4, -2]} intensity={0.3} />
        <spotLight position={[0, 10, 0]} intensity={0.4} angle={0.5} penumbra={1} />

        <Mannequin />

        <ContactShadows
          position={[0, -2.8, 0]}
          opacity={0.4}
          scale={8}
          blur={2}
          far={4}
        />

        <Environment preset="studio" />

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.8}
          autoRotate
          autoRotateSpeed={1}
        />
      </Canvas>
    </div>
  );
}
