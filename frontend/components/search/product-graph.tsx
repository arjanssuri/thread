"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useEffect, useMemo, useState, Suspense } from "react";
import * as THREE from "three";

// ── Types ────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  name: string;
  image_url: string | null;
  price: number | null;
  category: string | null;
  brand: string | null;
  position: [number, number, number];
  highlighted: boolean;
}

interface ProductGraphProps {
  nodes: GraphNode[];
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
}

// ── Category colors ──────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  shirts: "#4f46e5",
  tops: "#4f46e5",
  "t-shirts": "#4f46e5",
  dresses: "#db2777",
  shoes: "#d97706",
  sneakers: "#d97706",
  pants: "#059669",
  jeans: "#059669",
  jackets: "#7c3aed",
  coats: "#7c3aed",
  bags: "#ea580c",
  accessories: "#0d9488",
  shorts: "#16a34a",
  skirts: "#c026d3",
};

function getCatColor(cat: string | null): string {
  if (!cat) return "#4b5563";
  const c = cat.toLowerCase();
  for (const [key, hex] of Object.entries(CAT_COLORS)) {
    if (c.includes(key)) return hex;
  }
  return "#4b5563";
}

// ── Edges ────────────────────────────────────────────────────────────────────

function Edges({ nodes }: { nodes: GraphNode[] }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const n = nodes.length;
    const threshold = 20;
    const maxEdgesPerNode = 5;

    for (let i = 0; i < n; i++) {
      const dists: { j: number; d: number }[] = [];
      for (let j = i + 1; j < n; j++) {
        const dx = nodes[i].position[0] - nodes[j].position[0];
        const dy = nodes[i].position[1] - nodes[j].position[1];
        const dz = nodes[i].position[2] - nodes[j].position[2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < threshold) dists.push({ j, d });
      }
      dists.sort((a, b) => a.d - b.d);
      for (let k = 0; k < Math.min(maxEdgesPerNode, dists.length); k++) {
        const j = dists[k].j;
        positions.push(
          nodes[i].position[0], nodes[i].position[1], nodes[i].position[2],
          nodes[j].position[0], nodes[j].position[1], nodes[j].position[2]
        );
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [nodes]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#ffffff" opacity={0.08} transparent />
    </lineSegments>
  );
}

// ── Instanced nodes ──────────────────────────────────────────────────────────

function Nodes({ nodes, onNodeClick, onNodeHover }: ProductGraphProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const { camera, gl } = useThree();

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorArray = useMemo(() => new Float32Array(nodes.length * 3), [nodes.length]);

  // Set positions + colors
  useEffect(() => {
    if (!meshRef.current) return;

    const color = new THREE.Color();
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      dummy.position.set(...node.position);
      const s = node.highlighted ? 0.65 : 0.45;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      if (node.highlighted) {
        color.set("#eab308");
      } else {
        color.set(getCatColor(node.category));
      }
      colorArray[i * 3] = color.r;
      colorArray[i * 3 + 1] = color.g;
      colorArray[i * 3 + 2] = color.b;
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.geometry.setAttribute(
      "color",
      new THREE.InstancedBufferAttribute(colorArray, 3)
    );
  }, [nodes, dummy, colorArray]);

  // Hover highlight
  useEffect(() => {
    if (!meshRef.current || hoveredIdx === null) return;
    const color = new THREE.Color("#ffffff");
    const attr = meshRef.current.geometry.getAttribute("color") as THREE.InstancedBufferAttribute;
    if (attr) {
      attr.setXYZ(hoveredIdx, color.r, color.g, color.b);
      attr.needsUpdate = true;
    }

    return () => {
      if (!meshRef.current) return;
      const node = nodes[hoveredIdx];
      if (!node) return;
      const c = new THREE.Color(node.highlighted ? "#eab308" : getCatColor(node.category));
      const a = meshRef.current.geometry.getAttribute("color") as THREE.InstancedBufferAttribute;
      if (a) {
        a.setXYZ(hoveredIdx, c.r, c.g, c.b);
        a.needsUpdate = true;
      }
    };
  }, [hoveredIdx, nodes]);

  // Manual raycasting on the canvas element — bypasses R3F's event system
  // which is unreliable for instancedMesh after nodes update.
  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let currentHovered: number | null = null;
    let downPos = { x: 0, y: 0 };

    const raycast = (e: MouseEvent): number | null => {
      if (!meshRef.current) return null;
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      // Force large bounding sphere before every raycast so it never rejects
      meshRef.current.geometry.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(0, 0, 0),
        200
      );
      const hits = raycaster.intersectObject(meshRef.current);
      if (hits.length > 0 && hits[0].instanceId !== undefined && hits[0].instanceId < nodes.length) {
        return hits[0].instanceId;
      }
      return null;
    };

    const onMove = (e: MouseEvent) => {
      const idx = raycast(e);
      if (idx !== null) {
        if (idx !== currentHovered) {
          currentHovered = idx;
          setHoveredIdx(idx);
          onNodeHover?.(nodes[idx]);
        }
        gl.domElement.style.cursor = "pointer";
      } else if (currentHovered !== null) {
        currentHovered = null;
        setHoveredIdx(null);
        onNodeHover?.(null);
        gl.domElement.style.cursor = "default";
      }
    };

    const onDown = (e: MouseEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const onUp = (e: MouseEvent) => {
      const dx = e.clientX - downPos.x;
      const dy = e.clientY - downPos.y;
      if (Math.sqrt(dx * dx + dy * dy) < 6) {
        const idx = raycast(e);
        if (idx !== null) {
          onNodeClick?.(nodes[idx]);
        }
      }
    };

    const el = gl.domElement;
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.style.cursor = "default";
    };
  }, [camera, gl, nodes, onNodeClick, onNodeHover]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, nodes.length]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 16, 12]} />
      <meshStandardMaterial
        vertexColors
        roughness={0.3}
        metalness={0.15}
      />
    </instancedMesh>
  );
}

// ── Scene ────────────────────────────────────────────────────────────────────

function GraphScene({ nodes, onNodeClick, onNodeHover }: ProductGraphProps) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 40, 20]} intensity={0.7} />
      <pointLight position={[-30, 15, -20]} intensity={0.3} color="#6366f1" distance={100} />
      <pointLight position={[30, -10, 25]} intensity={0.2} color="#f59e0b" distance={100} />
      <hemisphereLight args={["#1a1a2e", "#0a0a0a", 0.4]} />

      <Edges nodes={nodes} />
      <Nodes nodes={nodes} onNodeClick={onNodeClick} onNodeHover={onNodeHover} />

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        autoRotate={false}
        minDistance={15}
        maxDistance={120}
        dampingFactor={0.08}
        enableDamping
      />
    </>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export function ProductGraph({ nodes, onNodeClick, onNodeHover }: ProductGraphProps) {
  return (
    <Canvas
      camera={{ position: [0, 80, 5], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: "#0a0a0a" }}
      dpr={[1, 1.5]}
    >
      <Suspense fallback={null}>
        <GraphScene nodes={nodes} onNodeClick={onNodeClick} onNodeHover={onNodeHover} />
      </Suspense>
    </Canvas>
  );
}
