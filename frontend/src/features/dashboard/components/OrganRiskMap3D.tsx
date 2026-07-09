"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { SpecialistResult } from "@/types";

interface OrganRiskMap3DProps {
  specialists: SpecialistResult[];
  activeSpec: string | null;
  onHotspotHover: (key: string | null) => void;
  onHotspotClick: (key: string) => void;
}

type HotspotKey = "retinal" | "cardiovascular" | "renal" | "neuropathy";

// Same specialist labels as the 2D map — kept in sync deliberately rather
// than imported, since this file must stay self-contained/dynamically
// importable without pulling the parent's SVG-only constants along.
const specialistLabels: Record<string, string> = {
  retinal: "Retina (Retinopathy)",
  renal: "Kidneys (Nephropathy)",
  neuropathy: "Nerves (Neuropathy)",
  cardiovascular: "Heart & Vessels",
};

// ---------------------------------------------------------------------
// Rig geometry. Every joint is defined once here and reused both by the
// mesh builder (HumanoidFigure) and the hotspot placer (Hotspots), so the
// dots are guaranteed to land on the actual rendered limbs instead of
// drifting out of sync with them. Coordinates are in a pelvis-centered
// local frame (y=0 at the hips); RIG_Y_OFFSET below re-centers the whole
// figure at the world origin for the camera/OrbitControls target.
// ---------------------------------------------------------------------
const HEAD_R = 0.115;
const HEAD_Y = 1.05;

const NECK_Y = 0.92;
const NECK_LEN = 0.1;

const TORSO_Y = 0.585;
const TORSO_R = 0.156;
const TORSO_LEN = 0.4;

const SHOULDER_X = 0.21;
const SHOULDER_Y = 0.82;
const ARM_LEN = 0.55;
const ARM_R = 0.045;
const ARM_ANGLE = 0.25; // outward lean, radians

const HIP_X = 0.085;
const LEG_LEN = 0.62;
const LEG_R = 0.065;
const LEG_ANGLE = 0.05; // outward lean, radians

// Legs used to hang from a separate pelvis capsule, but that capsule's
// rounded caps overlapped the torso's rounded bottom cap by a lot (~0.13
// units), stacking two translucent double-sided meshes on top of each
// other there and rendering as a dense, oddly-opaque, visually separate
// blob instead of reading as part of the same figure. Simplest fix: drop
// the pelvis mesh and hang the legs directly off the torso instead, at the
// same overlap depth (0.035) into the torso's cap that the shoulders
// already use at the top - so hips and shoulders attach symmetrically.
const TORSO_BOTTOM_EDGE_Y = TORSO_Y - TORSO_LEN / 2;
const HIP_Y = TORSO_BOTTOM_EDGE_Y - 0.035;

// Derived hand/foot endpoints — computed from the same pivot + angle used
// to render the limbs, so hotspots always sit exactly at the limb tip.
function limbEndpoint(
  pivot: [number, number, number],
  length: number,
  angle: number,
  side: number
): [number, number, number] {
  const [px, py, pz] = pivot;
  return [px + length * Math.sin(side * angle), py - length * Math.cos(side * angle), pz];
}

const RIG_Y_OFFSET = -0.24;

// ---------------------------------------------------------------------
// Hotspot placement. Every marker is positioned INSIDE the translucent
// mesh volume (embedded), not pinned to the outer surface. Two reasons:
//
// 1. Correctness bug: the previous neuropathy points took the limb's
//    true surface tip and then overwrote its z-coordinate with
//    `radius + epsilon` instead of offsetting FROM that point. That
//    moves the dot to distance sqrt(r² + (r+ε)²) ≈ 1.41r from the limb
//    axis — ~41% farther out than the limb's actual radius, i.e.
//    visibly floating off the hand/foot. Embedding on-axis (below)
//    sidesteps the whole class of bug: any point on the limb's
//    centerline is guaranteed to be inside the capsule, full stop.
// 2. Visual: the dot meshes themselves have real radius (0.032–0.05),
//    which is a big fraction of the torso/limb radius. Centering a dot
//    "on the surface" makes its own bulk poke out past the surface by
//    almost its full radius. Embedding the center inward instead makes
//    it read as a glowing marker visible *through* the translucent
//    tissue (fits the "scan hologram" look) instead of a ball stuck to
//    the outside of the body.
// ---------------------------------------------------------------------

// How far inward (from the true anatomical surface) each region's
// hotspot centers sit. Kept well clear of the marker's own radius so
// even the active/hover glow doesn't poke back out past the skin.
const TORSO_EMBED = 0.065; // sunk into torso/back surface
const HEAD_EMBED = 0.03; // sunk into head surface
const ARM_TIP_PULLBACK = 0.05; // shortened off the true fingertip
const LEG_TIP_PULLBACK = 0.06; // shortened off the true toe

// 3D hotspot coordinates in the same pelvis-centered frame as the rig
// above. labelOffset is where the floating label renders relative to the
// first point, so it doesn't sit directly on top of the dot it belongs to.
const hotspotMeta: Record<
  HotspotKey,
  { points: [number, number, number][]; labelOffset: [number, number, number] }
> = {
  retinal: {
    // Eyes, just under brow height, embedded back from the front of the
    // face rather than sitting proud on the head's outer surface.
    points: [
      [-0.04, HEAD_Y + 0.01, HEAD_R - HEAD_EMBED],
      [0.04, HEAD_Y + 0.01, HEAD_R - HEAD_EMBED],
    ],
    labelOffset: [0, 0.2, 0],
  },
  cardiovascular: {
    // The heart sits slightly off the body's midline (anatomically, to
    // the wearer's left of center) and a bit higher/more left per
    // feedback — upper-mid chest, not dead center.
    points: [[-0.06, TORSO_Y + 0.14, TORSO_R - TORSO_EMBED]],
    labelOffset: [0, 0.2, 0],
  },
  renal: {
    // Kidneys: lower back, mirrored either side of the spine, embedded
    // into the torso from the back rather than floating behind it.
    points: [
      [-0.075, TORSO_Y - 0.13, -(TORSO_R - TORSO_EMBED)],
      [0.075, TORSO_Y - 0.13, -(TORSO_R - TORSO_EMBED)],
    ],
    labelOffset: [0, -0.22, -0.08],
  },
  neuropathy: {
    // Hands & feet: on the limb's centerline (always inside the capsule
    // regardless of pullback distance), pulled back slightly from the
    // very tip so the marker doesn't clip past the rounded cap.
    points: [
      limbEndpoint([-SHOULDER_X, SHOULDER_Y, 0], ARM_LEN - ARM_TIP_PULLBACK, ARM_ANGLE, -1),
      limbEndpoint([SHOULDER_X, SHOULDER_Y, 0], ARM_LEN - ARM_TIP_PULLBACK, ARM_ANGLE, 1),
      limbEndpoint([-HIP_X, HIP_Y, 0], LEG_LEN - LEG_TIP_PULLBACK, LEG_ANGLE, -1),
      limbEndpoint([HIP_X, HIP_Y, 0], LEG_LEN - LEG_TIP_PULLBACK, LEG_ANGLE, 1),
    ],
    labelOffset: [0, -0.22, 0],
  },
};

// Ported directly from OrganRiskMap.tsx — same thresholds, same colors.
// Do not redefine the severity bands differently from the 2D version.
function getHotspotColor(score: number | null) {
  if (score === null) return "#94a3b8"; // Slate - unavailable
  if (score >= 0.7) return "#ef4444"; // Red
  if (score >= 0.4) return "#f59e0b"; // Amber
  return "#10b981"; // Emerald
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function useWebGLSupported() {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      setSupported(!!gl);
    } catch {
      setSupported(false);
    }
  }, []);
  return supported;
}

// Tracks the app's light/dark theme (toggled as a "dark" class on <html>,
// see ThemeToggle.tsx) so the 3D material can react to it. The current
// material — bright cyan emissive glow + pale sky-blue wireframe — was
// tuned to pop against the dark navy panel and reads as washed-out/
// scratchy on a light panel, so this lets HumanoidFigure swap to a
// richer, more opaque, darker-lined look in light mode instead.
function useIsDark() {
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

/**
 * Abstract, translucent "scanned hologram" figure built from primitive
 * geometry only — no imported mesh asset. Limbs are attached via nested
 * pivot groups (shoulder -> arm, hip -> leg) so each one hangs from, and
 * visually merges into, its parent joint rather than floating nearby.
 * Low-poly (faceted) segment counts on both the solid and wireframe
 * layers give it a deliberate low-fi "scan mesh" look instead of reading
 * as a smoothed-then-wireframed mismatch.
 */
function HumanoidFigure({ isDark }: { isDark: boolean }) {
  // Dark mode: bright, glowy "hologram" — cyan emissive pop against a
  // near-black panel reads as a scan effect.
  // Light mode: same sky-blue family, but opacity dropped further than
  // it first looks like it should need. The body is double-sided (so it
  // doesn't look hollow/backface-culled mid-rotation), which means at
  // most viewing angles you're looking through TWO translucent layers
  // (the near wall and the far wall of the same capsule) stacked on top
  // of each other, plus the wireframe overlay on top of that — so the
  // effective opacity reads much higher than the nominal number. 0.38
  // was still landing as a fairly solid-looking blue shape rather than
  // the glassy/translucent figure this is supposed to be.
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(isDark ? "#0ea5e9" : "#3b5bdb"),
        transparent: true,
        opacity: isDark ? 0.44 : 0.44,
        roughness: 0.2,
        metalness: 0.05,
        clearcoat: 0.4,
        clearcoatRoughness: 0.3,
        emissive: new THREE.Color(isDark ? "#22d3ee" : "#4c6ef5"),
        emissiveIntensity: isDark ? 0.14 : 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [isDark]
  );

  const wireMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(isDark ? "#38bdf8" : "#1e3a8a"),
        wireframe: true,
        transparent: true,
        opacity: isDark ? 0.35 : 0.65,
        depthWrite: false,
      }),
    [isDark]
  );

  return (
    <group position={[0, RIG_Y_OFFSET, 0]}>
      {/* Head */}
      <mesh position={[0, HEAD_Y, 0]} material={bodyMaterial} renderOrder={1}>
        <sphereGeometry args={[HEAD_R, 10, 8]} />
      </mesh>
      <mesh position={[0, HEAD_Y, 0]} material={wireMaterial} renderOrder={2}>
        <sphereGeometry args={[HEAD_R + 0.004, 10, 8]} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, NECK_Y, 0]} material={bodyMaterial} renderOrder={1}>
        <cylinderGeometry args={[0.04, 0.052, NECK_LEN, 8]} />
      </mesh>

      {/* Torso */}
      <mesh position={[0, TORSO_Y, 0]} material={bodyMaterial} renderOrder={1}>
        <capsuleGeometry args={[TORSO_R, TORSO_LEN, 4, 8]} />
      </mesh>
      <mesh position={[0, TORSO_Y, 0]} material={wireMaterial} renderOrder={2}>
        <capsuleGeometry args={[TORSO_R + 0.004, TORSO_LEN, 4, 8]} />
      </mesh>

      {/* Arms — each is a pivot group at the shoulder, rotated outward,
          with the capsule hanging from local y=0 down to -ARM_LEN so it
          is physically anchored (and overlapping) at the shoulder. */}
      {[-1, 1].map((side) => (
        <group
          key={`arm-${side}`}
          position={[side * SHOULDER_X, SHOULDER_Y, 0]}
          rotation={[0, 0, side * ARM_ANGLE]}
        >
          <mesh position={[0, -ARM_LEN / 2, 0]} material={bodyMaterial} renderOrder={1}>
            <capsuleGeometry args={[ARM_R, ARM_LEN - ARM_R * 2, 4, 8]} />
          </mesh>
          <mesh position={[0, -ARM_LEN / 2, 0]} material={wireMaterial} renderOrder={2}>
            <capsuleGeometry args={[ARM_R + 0.003, ARM_LEN - ARM_R * 2, 4, 8]} />
          </mesh>
        </group>
      ))}

      {/* Legs — attach directly to the torso at HIP_Y (see comment above),
          same pivot-from-joint approach as the arms. */}
      {[-1, 1].map((side) => (
        <group
          key={`leg-${side}`}
          position={[side * HIP_X, HIP_Y, 0]}
          rotation={[0, 0, side * LEG_ANGLE]}
        >
          <mesh position={[0, -LEG_LEN / 2, 0]} material={bodyMaterial} renderOrder={1}>
            <capsuleGeometry args={[LEG_R, LEG_LEN - LEG_R * 2, 4, 8]} />
          </mesh>
          <mesh position={[0, -LEG_LEN / 2, 0]} material={wireMaterial} renderOrder={2}>
            <capsuleGeometry args={[LEG_R + 0.003, LEG_LEN - LEG_R * 2, 4, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Hotspots({
  specialists,
  activeSpec,
  onHover,
  onClick,
  isDark,
}: {
  specialists: SpecialistResult[];
  activeSpec: string | null;
  onHover: (key: string | null) => void;
  onClick: (key: string) => void;
  isDark: boolean;
}) {
  const specMap = useMemo(
    () =>
      specialists.reduce((acc, s) => {
        acc[s.specialist] = s;
        return acc;
      }, {} as Record<string, SpecialistResult>),
    [specialists]
  );

  return (
    <group position={[0, RIG_Y_OFFSET, 0]}>
      {(Object.keys(hotspotMeta) as HotspotKey[]).map((key) => {
        const finding = specMap[key];
        if (!finding) return null;
        const meta = hotspotMeta[key];
        const isActive = activeSpec === key;
        const color = getHotspotColor(finding.risk_score);
        const labelAnchor = meta.points[0];
        const dotR = isActive ? 0.05 : 0.032;

        return (
          <group key={key}>
            {meta.points.map((p, i) => (
              <group key={i} position={p}>
                {/* Oversized invisible hit target — same trick the old SVG
                    used with oversized hit-circles, for easier targeting
                    on both mouse and touch. */}
                <mesh
                  onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                    e.stopPropagation();
                    onHover(key);
                    document.body.style.cursor = "pointer";
                  }}
                  onPointerOut={(e: ThreeEvent<PointerEvent>) => {
                    e.stopPropagation();
                    onHover(null);
                    document.body.style.cursor = "auto";
                  }}
                  onClick={(e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation();
                    onClick(key);
                  }}
                >
                  <sphereGeometry args={[0.1, 10, 10]} />
                  <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>

                {isActive && (
                  <mesh renderOrder={18}>
                    <sphereGeometry args={[dotR + 0.035, 14, 14]} />
                    <meshBasicMaterial
                      color={color}
                      transparent
                      opacity={0.22}
                      depthWrite={false}
                      depthTest={false}
                    />
                  </mesh>
                )}

                {/* Soft glow behind the dot for legibility, replacing an
                    earlier solid dark/white ring outline that read as a
                    harsh "stroke" wrapped around the marker. This is the
                    dot's own color, larger and much more transparent, so
                    it just softly bleeds outward instead of drawing a
                    hard-edged ring in a clashing color. depthTest is off
                    for the same reason as the dot below — see that
                    comment. */}
                <mesh renderOrder={19}>
                  <sphereGeometry args={[dotR * 1.6, 14, 14]} />
                  <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.28}
                    depthWrite={false}
                    depthTest={false}
                  />
                </mesh>

                <mesh renderOrder={20}>
                  <sphereGeometry args={[dotR, 14, 14]} />
                  <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.9}
                    roughness={0.35}
                    transparent
                    depthTest={false}
                  />
                </mesh>
              </group>
            ))}

            {isActive && (
              <Html
                position={[
                  labelAnchor[0] + meta.labelOffset[0],
                  labelAnchor[1] + meta.labelOffset[1],
                  labelAnchor[2] + meta.labelOffset[2],
                ]}
                center
                occlude={false}
                style={{ pointerEvents: "none" }}
              >
                <span className="whitespace-nowrap rounded-full border border-slate-200 bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900/90 dark:text-white">
                  {specialistLabels[key] ?? key}
                </span>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

// Faint dashed-look scanning ring beneath the figure's feet, echoing the
// old SVG's base ellipse for continuity with the app's existing motif.
// Slightly darker/more opaque in light mode so it doesn't disappear
// against the light panel the way the original fixed slate did.
function ScanRing({ isDark }: { isDark: boolean }) {
  const footBottomWorld =
    limbEndpoint([HIP_X, HIP_Y, 0], LEG_LEN, LEG_ANGLE, 1)[1] - LEG_R + RIG_Y_OFFSET;
  return (
    <mesh position={[0, footBottomWorld, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
      <ringGeometry args={[0.52, 0.56, 40]} />
      <meshBasicMaterial
        color={isDark ? "#64748b" : "#475569"}
        transparent
        opacity={isDark ? 0.3 : 0.4}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function Scene({
  specialists,
  activeSpec,
  onHotspotHover,
  onHotspotClick,
  autoRotate,
  isDark,
}: OrganRiskMap3DProps & { autoRotate: boolean; isDark: boolean }) {
  return (
    <>
      <ambientLight intensity={isDark ? 0.65 : 0.8} />
      <directionalLight position={[2, 3, 2]} intensity={0.9} color="#e0e7ff" />
      <pointLight position={[-2, 0.6, -1.2]} intensity={0.5} color="#0ea5e9" />
      <pointLight position={[0.5, 1, 1.8]} intensity={0.35} color="#f8fafc" />

      <Suspense fallback={null}>
        <HumanoidFigure isDark={isDark} />
        <ScanRing isDark={isDark} />
        <Hotspots
          specialists={specialists}
          activeSpec={activeSpec}
          onHover={onHotspotHover}
          onClick={onHotspotClick}
          isDark={isDark}
        />
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={1.8}
        maxDistance={3.6}
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI - Math.PI / 5}
        autoRotate={autoRotate}
        autoRotateSpeed={0.4}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

export default function OrganRiskMap3D({
  specialists,
  activeSpec,
  onHotspotHover,
  onHotspotClick,
}: OrganRiskMap3DProps) {
  const reducedMotion = useReducedMotion();
  const webglSupported = useWebGLSupported();
  const isDark = useIsDark();

  // Still probing for WebGL support — render nothing rather than flash
  // a fallback message that might immediately disappear.
  if (webglSupported === null) {
    return <div className="h-full w-full" />;
  }

  if (!webglSupported) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-6 text-center">
        <span className="text-sm font-medium text-slate-500">
          3D view isn&apos;t supported in this browser.
        </span>
        <span className="text-xs text-slate-400">
          Try a recent version of Chrome, Edge, Firefox, or Safari.
        </span>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Keyboard-accessible mirror of the hotspot interactions — 3D
          meshes can't natively take DOM focus, so focusable buttons here
          drive the exact same hover/click state as pointer interaction
          with the mesh hit-targets. */}
      <div className="sr-only">
        {(Object.keys(hotspotMeta) as HotspotKey[]).map((key) => {
          const finding = specialists.find((s) => s.specialist === key);
          if (!finding) return null;
          return (
            <button
              key={key}
              type="button"
              aria-label={`${specialistLabels[key] ?? key} — ${
                activeSpec === key ? "selected" : "select to highlight"
              }`}
              onFocus={() => onHotspotHover(key)}
              onBlur={() => onHotspotHover(null)}
              onClick={() => onHotspotClick(key)}
            >
              {specialistLabels[key] ?? key}
            </button>
          );
        })}
      </div>

      <Canvas
        camera={{ position: [0, 0.1, 2.7], fov: 40 }}
        dpr={[1, 1.75]}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <Scene
          specialists={specialists}
          activeSpec={activeSpec}
          onHotspotHover={onHotspotHover}
          onHotspotClick={onHotspotClick}
          autoRotate={!reducedMotion}
          isDark={isDark}
        />
      </Canvas>
    </div>
  );
}
