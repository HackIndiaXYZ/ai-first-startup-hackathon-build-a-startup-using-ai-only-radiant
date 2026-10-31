"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Hero3DSceneProps {
  onReady?: () => void;
  onContextLost?: () => void;
  isPaused?: boolean;
  dpr?: number;
}

/**
 * Deterministic pseudo-random number generator for pure rendering without Math.random()
 */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Creates dynamic canvas-drawn textures for the 3 floating glass ledger cards in code.
 * Zero external models, fonts, HDRs, or network requests.
 */
function createCardTexture(type: "udhar" | "stock" | "reminder"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // 1. Smooth Dark Glass Gradient Background
    const bgGrad = ctx.createLinearGradient(0, 0, 512, 256);
    bgGrad.addColorStop(0, "rgba(35, 25, 65, 0.92)");
    bgGrad.addColorStop(1, "rgba(10, 6, 22, 0.96)");
    ctx.fillStyle = bgGrad;

    // Rounded rectangle border
    const r = 28;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(512 - r, 0);
    ctx.quadraticCurveTo(512, 0, 512, r);
    ctx.lineTo(512, 256 - r);
    ctx.quadraticCurveTo(512, 256, 512 - r, 256);
    ctx.lineTo(r, 256);
    ctx.quadraticCurveTo(0, 256, 0, 256 - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();

    // Subtle luminous glass border
    ctx.lineWidth = 4;
    const borderGrad = ctx.createLinearGradient(0, 0, 512, 256);
    borderGrad.addColorStop(0, "rgba(255, 255, 255, 0.45)");
    borderGrad.addColorStop(0.5, "rgba(139, 92, 246, 0.55)");
    borderGrad.addColorStop(1, "rgba(245, 158, 11, 0.4)");
    ctx.strokeStyle = borderGrad;
    ctx.stroke();

    // Subtle inner top gloss highlight
    ctx.beginPath();
    ctx.ellipse(256, 12, 220, 16, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fill();

    // 2. Content based on card type
    ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
    ctx.textBaseline = "middle";

    if (type === "udhar") {
      // Icon + Customer Name
      ctx.fillStyle = "#ffffff";
      ctx.fillText("🛒 Ramesh Kumar", 28, 56);

      // Status Chip
      ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
      ctx.fillRect(360, 36, 120, 38);
      ctx.strokeStyle = "rgba(16, 185, 129, 0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(360, 36, 120, 38);
      ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#34d399";
      ctx.fillText("✓ Confirmed", 370, 56);

      // Divider line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(28, 110);
      ctx.lineTo(484, 110);
      ctx.stroke();

      // Transaction details
      ctx.font = "20px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.fillText("Total: Rs 500  ·  Cash: Rs 200", 28, 160);

      // Udhar Pill
      ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText("Udhar Rs 300", 28, 208);
    } else if (type === "stock") {
      // Icon + Product Name
      ctx.fillStyle = "#ffffff";
      ctx.fillText("📦 Doodh 2 packet", 28, 56);

      // Status Chip
      ctx.fillStyle = "rgba(139, 92, 246, 0.2)";
      ctx.fillRect(350, 36, 130, 38);
      ctx.strokeStyle = "rgba(139, 92, 246, 0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(350, 36, 130, 38);
      ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#c4b5fd";
      ctx.fillText("Stock Update", 360, 56);

      // Divider line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(28, 110);
      ctx.lineTo(484, 110);
      ctx.stroke();

      // Stock details
      ctx.font = "20px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.fillText("Inventory decremented automatically", 28, 160);

      // Remaining stock pill
      ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#34d399";
      ctx.fillText("Remaining: 18 packets in stock", 28, 208);
    } else {
      // WhatsApp Reminder Pill
      ctx.fillStyle = "#ffffff";
      ctx.fillText("💬 1-Tap WhatsApp Reminder", 28, 70);

      // Divider line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(28, 120);
      ctx.lineTo(484, 120);
      ctx.stroke();

      ctx.font = "20px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillText("Automated reminder link generated", 28, 165);

      ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#6ee7b7";
      ctx.fillText("✓ Reminder sent to customer", 28, 208);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

/**
 * Creates radial glow billboard texture for faking volumetric bloom with zero post-processing passes.
 */
function createRadialGlowTexture(colorHex: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, colorHex);
    grad.addColorStop(0.35, colorHex.replace(/[\d.]+\)$/, "0.35)"));
    grad.addColorStop(0.7, colorHex.replace(/[\d.]+\)$/, "0.1)"));
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

/**
 * Central Glowing Voice Orb Component
 */
function VoiceOrb() {
  const orbGroupRef = useRef<THREE.Group>(null);
  const glowMeshRef = useRef<THREE.Mesh>(null);
  const glowSpriteRef = useRef<THREE.Sprite>(null);

  const glowTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    return createRadialGlowTexture("rgba(139, 92, 246, 0.8)");
  }, []);

  const coreGeometry = useMemo(() => new THREE.SphereGeometry(1.15, 48, 48), []);
  const outerRimGeometry = useMemo(() => new THREE.SphereGeometry(1.22, 48, 48), []);
  const orbitRingGeometry = useMemo(() => new THREE.RingGeometry(1.7, 1.73, 64), []);
  const saffronPointGeo = useMemo(() => new THREE.SphereGeometry(0.06, 16, 16), []);

  useEffect(() => {
    return () => {
      glowTexture?.dispose();
      coreGeometry.dispose();
      outerRimGeometry.dispose();
      orbitRingGeometry.dispose();
      saffronPointGeo.dispose();
    };
  }, [glowTexture, coreGeometry, outerRimGeometry, orbitRingGeometry, saffronPointGeo]);

  useFrame((_, delta) => {
    const t = performance.now() * 0.001;
    if (orbGroupRef.current) {
      orbGroupRef.current.rotation.y += delta * 0.25;
      orbGroupRef.current.rotation.x = Math.sin(t * 0.8) * 0.08;
    }
    if (glowMeshRef.current) {
      const scale = 1 + Math.sin(t * 2.5) * 0.04;
      glowMeshRef.current.scale.set(scale, scale, scale);
    }
    if (glowSpriteRef.current) {
      const spriteScale = 4.2 + Math.sin(t * 2) * 0.25;
      glowSpriteRef.current.scale.set(spriteScale, spriteScale, 1);
    }
  });

  return (
    <group ref={orbGroupRef}>
      {/* Fake volumetric glow billboard (additive sprite, 0 postprocessing) */}
      {glowTexture && (
        <sprite ref={glowSpriteRef} position={[0, 0, -0.2]}>
          <spriteMaterial
            attach="material"
            map={glowTexture}
            blending={THREE.AdditiveBlending}
            transparent
            opacity={0.7}
          />
        </sprite>
      )}

      {/* Inner Emissive Sphere */}
      <mesh geometry={coreGeometry}>
        <meshStandardMaterial
          color="#1e1035"
          emissive="#7c3aed"
          emissiveIntensity={0.65}
          roughness={0.25}
          metalness={0.4}
        />
      </mesh>

      {/* Outer Additive Fresnel-Style Rim Sphere */}
      <mesh ref={glowMeshRef} geometry={outerRimGeometry}>
        <meshStandardMaterial
          color="#6366f1"
          emissive="#a78bfa"
          emissiveIntensity={0.9}
          roughness={0.1}
          metalness={0.2}
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Orbit Ring with Saffron Accent Point */}
      <mesh geometry={orbitRingGeometry} rotation={[Math.PI / 3, 0, 0]}>
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={saffronPointGeo} position={[1.71, 0, 0]}>
        <meshBasicMaterial color="#f59e0b" />
      </mesh>
    </group>
  );
}

/**
 * 64-Bar Waveform Ring Component (pulses via sum of sines, no mic)
 */
function WaveformRing() {
  const barsGroupRef = useRef<THREE.Group>(null);
  const BAR_COUNT = 64;
  const RADIUS = 1.82;

  const barGeometry = useMemo(() => new THREE.BoxGeometry(0.045, 1, 0.045), []);
  const barMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#c4b5fd",
        emissive: "#8b5cf6",
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.3,
      }),
    []
  );

  const barMeshes = useMemo(() => {
    const meshes: THREE.Mesh[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const angle = (i / BAR_COUNT) * Math.PI * 2;
      const x = Math.cos(angle) * RADIUS;
      const y = Math.sin(angle) * RADIUS;
      const mesh = new THREE.Mesh(barGeometry, barMaterial);
      mesh.position.set(x, y, 0);
      mesh.rotation.z = angle - Math.PI / 2;
      meshes.push(mesh);
    }
    return meshes;
  }, [BAR_COUNT, RADIUS, barGeometry, barMaterial]);

  useEffect(() => {
    return () => {
      barGeometry.dispose();
      barMaterial.dispose();
    };
  }, [barGeometry, barMaterial]);

  useFrame((_, delta) => {
    const t = performance.now() * 0.001;
    if (barsGroupRef.current) {
      barsGroupRef.current.rotation.z += delta * 0.08;
    }

    for (let i = 0; i < BAR_COUNT; i++) {
      const mesh = barMeshes[i];
      // Sum of multiple sinusoidal frequencies for natural voice amplitude simulation
      const s1 = Math.sin(t * 3.6 + i * 0.38);
      const s2 = Math.sin(t * 5.2 - i * 0.72 + 1.4);
      const s3 = Math.sin(t * 1.8 + i * 0.15);
      const s4 = Math.sin(t * 8.0 + i * 0.9);
      const wave = Math.max(0.12, 0.25 + 0.35 * (s1 * 0.4 + s2 * 0.3 + s3 * 0.2 + s4 * 0.1 + 0.5));

      const barHeight = wave * 0.85;
      mesh.scale.set(1, barHeight, 1);
    }
  });

  return (
    <group ref={barsGroupRef} rotation={[Math.PI / 7, 0, 0]}>
      {barMeshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </group>
  );
}

/**
 * Instanced Particle Field (pure, stateless drift calculation without mutating objects)
 */
function InstancedParticles({ count }: { count: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particleGeo = useMemo(() => new THREE.SphereGeometry(0.024, 8, 8), []);
  const particleMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#a78bfa",
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  // Deterministically precomputed particle spawn parameters
  const particlesParam = useMemo(() => {
    const params = [];
    for (let i = 0; i < count; i++) {
      const rx = (pseudoRandom(i * 1.37) - 0.5) * 8.5;
      const ry = (pseudoRandom(i * 2.81) - 0.5) * 7.5;
      const rz = (pseudoRandom(i * 3.49) - 0.5) * 5.5;
      const speedY = 0.08 + pseudoRandom(i * 4.93) * 0.16;
      const freq = 1.0 + pseudoRandom(i * 5.17) * 2.5;
      const amp = 0.04 + pseudoRandom(i * 6.61) * 0.08;
      params.push({ x: rx, initialY: ry, z: rz, speedY, freq, amp });
    }
    return params;
  }, [count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    return () => {
      particleGeo.dispose();
      particleMat.dispose();
    };
  }, [particleGeo, particleMat]);

  useFrame(() => {
    if (!meshRef.current) return;
    const t = performance.now() * 0.001;

    for (let i = 0; i < count; i++) {
      const p = particlesParam[i];
      // Pure mathematical loop: no mutation of p
      const curY = (((p.initialY + t * p.speedY + 3.8) % 7.6) - 3.8);
      const xOffset = Math.sin(t * p.freq + i) * p.amp;

      dummy.position.set(p.x + xOffset, curY, p.z);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} args={[particleGeo, particleMat, count]} />;
}

/**
 * 3 Floating Glass Ledger Cards Component
 */
function FloatingCards() {
  const cardGroupRef = useRef<THREE.Group>(null);

  const textures = useMemo(() => {
    if (typeof document === "undefined") return null;
    return {
      udhar: createCardTexture("udhar"),
      stock: createCardTexture("stock"),
      reminder: createCardTexture("reminder"),
    };
  }, []);

  const cardGeo = useMemo(() => new THREE.PlaneGeometry(2.1, 1.05), []);
  const pillGeo = useMemo(() => new THREE.PlaneGeometry(1.8, 0.55), []);

  const matUdhar = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: textures?.udhar,
        transparent: true,
        opacity: 0.94,
        roughness: 0.15,
        metalness: 0.15,
        side: THREE.DoubleSide,
      }),
    [textures?.udhar]
  );

  const matStock = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: textures?.stock,
        transparent: true,
        opacity: 0.94,
        roughness: 0.15,
        metalness: 0.15,
        side: THREE.DoubleSide,
      }),
    [textures?.stock]
  );

  const matReminder = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: textures?.reminder,
        transparent: true,
        opacity: 0.94,
        roughness: 0.15,
        metalness: 0.15,
        side: THREE.DoubleSide,
      }),
    [textures?.reminder]
  );

  useEffect(() => {
    return () => {
      textures?.udhar.dispose();
      textures?.stock.dispose();
      textures?.reminder.dispose();
      cardGeo.dispose();
      pillGeo.dispose();
      matUdhar.dispose();
      matStock.dispose();
      matReminder.dispose();
    };
  }, [textures, cardGeo, pillGeo, matUdhar, matStock, matReminder]);

  const card1Ref = useRef<THREE.Mesh>(null);
  const card2Ref = useRef<THREE.Mesh>(null);
  const card3Ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const t = performance.now() * 0.001;

    if (card1Ref.current) {
      card1Ref.current.position.y = 1.35 + Math.sin(t * 1.4) * 0.08;
      card1Ref.current.rotation.z = 0.06 + Math.cos(t * 1.1) * 0.02;
    }
    if (card2Ref.current) {
      card2Ref.current.position.y = -1.35 + Math.sin(t * 1.6 + 1.2) * 0.08;
      card2Ref.current.rotation.z = -0.05 + Math.cos(t * 1.3 + 1.2) * 0.02;
    }
    if (card3Ref.current) {
      card3Ref.current.position.y = 0.75 + Math.sin(t * 1.5 + 2.5) * 0.06;
      card3Ref.current.rotation.z = 0.03 + Math.cos(t * 1.2 + 2.5) * 0.02;
    }
  });

  return (
    <group ref={cardGroupRef}>
      {/* Card 1: Ramesh Kumar Udhar Rs 300 (Top Right) */}
      <mesh
        ref={card1Ref}
        geometry={cardGeo}
        material={matUdhar}
        position={[1.85, 1.35, 0.7]}
        rotation={[0.06, -0.25, 0.06]}
      />

      {/* Card 2: Doodh 2 packet Stock Update (Bottom Left) */}
      <mesh
        ref={card2Ref}
        geometry={cardGeo}
        material={matStock}
        position={[-1.75, -1.35, 0.8]}
        rotation={[-0.06, 0.28, -0.05]}
      />

      {/* Card 3: 1-Tap WhatsApp Reminder (Top Left) */}
      <mesh
        ref={card3Ref}
        geometry={pillGeo}
        material={matReminder}
        position={[-1.85, 0.75, 0.4]}
        rotation={[0.04, 0.18, 0.03]}
      />
    </group>
  );
}

/**
 * Root Interactive 3D World (Handles Pointer Parallax & Scroll Scrub)
 */
function SceneContainer() {
  const sceneRootRef = useRef<THREE.Group>(null);
  const targetRot = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const scrollOffset = useRef<number>(0);

  // Desktop pointer parallax & scroll listener
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;

    const handlePointerMove = (e: MouseEvent) => {
      if (isTouch) return;
      const normX = (e.clientX / window.innerWidth - 0.5) * 2;
      const normY = (e.clientY / window.innerHeight - 0.5) * 2;
      targetRot.current = {
        x: normY * 0.18,
        y: normX * 0.26,
      };
    };

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const heroHeight = window.innerHeight * 0.9;
      scrollOffset.current = Math.min(1, Math.max(0, scrollY / heroHeight));
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useFrame(() => {
    if (sceneRootRef.current) {
      // Smooth lerp to pointer parallax
      sceneRootRef.current.rotation.y = THREE.MathUtils.lerp(
        sceneRootRef.current.rotation.y,
        targetRot.current.y,
        0.05
      );
      sceneRootRef.current.rotation.x = THREE.MathUtils.lerp(
        sceneRootRef.current.rotation.x,
        targetRot.current.x,
        0.05
      );

      // Scroll-linked camera/scene tilt across hero
      const scrollProgress = scrollOffset.current;
      sceneRootRef.current.position.y = -scrollProgress * 0.8;
      sceneRootRef.current.position.z = -scrollProgress * 1.2;
    }
  });

  // Adaptive particle count: ~1200 on desktop, ~400 on mobile
  const particleCount = useMemo(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return 400;
    }
    return 1200;
  }, []);

  return (
    <group ref={sceneRootRef}>
      {/* Ambient and directional lights */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 5, 4]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-3, -2, 2]} intensity={0.8} color="#a78bfa" />
      <pointLight position={[3, -2, -2]} intensity={0.5} color="#f59e0b" />

      {/* Voice Orb */}
      <VoiceOrb />

      {/* 64-Bar Waveform Ring */}
      <WaveformRing />

      {/* 3 Floating Glass Ledger Cards */}
      <FloatingCards />

      {/* Instanced Particles */}
      <InstancedParticles count={particleCount} />
    </group>
  );
}

/**
 * Main exported component wrapped in @react-three/fiber Canvas
 */
export default function Hero3DScene({
  onReady,
  onContextLost,
  isPaused = false,
  dpr = 1.5,
}: Hero3DSceneProps) {
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      onReady?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [onReady]);

  return (
    <div className="w-full h-full relative" aria-hidden="true" role="presentation">
      <Canvas
        camera={{ position: [0, 0, 6.2], fov: 42 }}
        dpr={dpr}
        frameloop={isPaused ? "never" : "always"}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          onReady?.();

          // Context lost handler
          const handleContextLost = (e: Event) => {
            e.preventDefault();
            console.warn("WebGL Context lost in Hero3DScene, falling back to poster.");
            onContextLost?.();
          };

          const domEl = gl.domElement;
          domEl.addEventListener("webglcontextlost", handleContextLost);
        }}
        style={{ width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <SceneContainer />
      </Canvas>
    </div>
  );
}
