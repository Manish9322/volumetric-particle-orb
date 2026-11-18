import * as THREE from 'three';
import type { LayerConfig, OrbLayerId } from './types';

export interface LayerGeometryOptions {
  layerId: OrbLayerId;
  layer: LayerConfig;
  effectiveCount: number;
}

/**
 * Fast, seeded Mulberry32 PRNG in [0, 1) for isotropic random spherical placement
 * without lattice, ring, or stream patterns.
 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates an isotropic, randomly distributed, shell-concentrated BufferGeometry:
 * - ~90% of particles are randomly scattered across the layer's thin outer spherical shell
 *   for a crisp, glowing volumetric silhouette with zero geometric patterns or rings.
 * - ~10% form a sparse, restrained interior haze for subtle 3D depth without crowding inner layers.
 * - All three layers share the exact same central origin (0, 0, 0) and coordinate axes.
 */
export function createLayerParticleGeometry({
  layerId,
  layer,
  effectiveCount,
}: LayerGeometryOptions): THREE.BufferGeometry {
  const radius = Math.max(0.2, layer.radius);
  const totalParticles = Math.max(800, Math.round(effectiveCount));
  const shellCount = Math.round(totalParticles * 0.9);

  const seed = layerId === 'inner' ? 13371 : layerId === 'main' ? 26743 : 49157;
  const rand = createSeededRandom(seed);

  const positions = new Float32Array(totalParticles * 3);
  // aParams: x = brightnessSeed, y = shimmerPhase, z = noisePhase, w = zone (1 = shell, 0 = sparse interior)
  const params = new Float32Array(totalParticles * 4);
  // aNoise: x = shimmerSpeed, y = colorBias, z = motionSpeed, w = radialNorm
  const noiseAttrs = new Float32Array(totalParticles * 4);

  const shellMinFrac = layerId === 'inner' ? 0.935 : layerId === 'main' ? 0.95 : 0.955;
  const shellMaxFrac = layerId === 'outer' ? 1.015 : 1.005;

  const interiorMinFrac = layerId === 'inner' ? 0.35 : layerId === 'main' ? 0.6 : 0.85;
  const interiorMaxFrac = layerId === 'inner' ? 0.9 : layerId === 'main' ? 0.92 : 0.94;

  for (let i = 0; i < totalParticles; i++) {
    // True uniform random point on the unit sphere (no rings, lattices, or pole clustering)
    const cosTheta = 2.0 * rand() - 1.0;
    const sinTheta = Math.sqrt(Math.max(0, 1.0 - cosTheta * cosTheta));
    const phi = rand() * Math.PI * 2.0;

    const nx = sinTheta * Math.cos(phi);
    const ny = cosTheta;
    const nz = sinTheta * Math.sin(phi);

    const isShell = i < shellCount;
    let radialFrac: number;
    let brightnessSeed: number;

    if (isShell) {
      // Bias tightly toward the spherical surface so the shell edge reads sharply
      const shellBias = Math.pow(rand(), 0.45);
      radialFrac = shellMinFrac + shellBias * (shellMaxFrac - shellMinFrac);

      const baseBright = layerId === 'outer' ? 0.56 : layerId === 'inner' ? 0.78 : 0.76;
      const spread = layerId === 'outer' ? 0.28 : 0.30;
      brightnessSeed = baseBright + rand() * spread;
    } else {
      // Sparse interior particles biased away from the exact center to prevent clumping
      const interiorBias = Math.pow(rand(), 0.65);
      radialFrac = interiorMinFrac + interiorBias * (interiorMaxFrac - interiorMinFrac);
      brightnessSeed = (layerId === 'outer' ? 0.38 : 0.44) + rand() * 0.20;
    }

    const r = radius * radialFrac;
    const i3 = i * 3;
    positions[i3] = nx * r;
    positions[i3 + 1] = ny * r;
    positions[i3 + 2] = nz * r;

    const i4 = i * 4;
    params[i4] = brightnessSeed;
    params[i4 + 1] = rand() * Math.PI * 2.0; // shimmerPhase
    params[i4 + 2] = rand() * Math.PI * 2.0; // noisePhase
    params[i4 + 3] = isShell ? 1.0 : 0.0;

    noiseAttrs[i4] = 0.65 + rand() * 0.90; // shimmerSpeed
    noiseAttrs[i4 + 1] = (rand() - 0.5) * 0.28; // colorBias
    noiseAttrs[i4 + 2] = 0.65 + rand() * 0.75; // motionSpeed
    noiseAttrs[i4 + 3] = radialFrac; // radialNorm
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aParams', new THREE.BufferAttribute(params, 4));
  geometry.setAttribute('aNoise', new THREE.BufferAttribute(noiseAttrs, 4));

  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, 0, 0),
    radius * 1.25
  );

  return geometry;
}
