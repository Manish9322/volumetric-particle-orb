'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createLayerParticleGeometry } from '@/lib/orb/particleGeometry';
import { MAX_ACTIVE_WAVES, orbFragmentShader, orbVertexShader } from '@/lib/orb/shaders';
import type { LayerConfig, OrbConfig, OrbLayerId } from '@/lib/orb/types';

// Module-scope reusable math helpers (zero GC inside render loop)
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _intersect = new THREE.Vector3();
const _origin = new THREE.Vector3(0, 0, 0);
const _hitPoint = new THREE.Vector3();
const _closestPoint = new THREE.Vector3();
const _mainSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2.4);
const _outerSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2.9);

const _axisY = new THREE.Vector3(0, 1, 0);
const _axisX = new THREE.Vector3(1, 0, 0);
const _dqY = new THREE.Quaternion();
const _dqX = new THREE.Quaternion();
const _dqIdle = new THREE.Quaternion();
const _invQuat = new THREE.Quaternion();

const _targetHighlight = new THREE.Color();
const _targetLightGray = new THREE.Color();
const _targetMidGray = new THREE.Color();
const _targetCharcoal = new THREE.Color();
const _targetShadow = new THREE.Color();

export interface PointerStateRef {
  x: number;
  y: number;
  active: boolean;
}

export interface PendingWaveClick {
  ndcX: number;
  ndcY: number;
}

export interface DragInteractionRef {
  isDragging: boolean;
  pendingDeltaYaw: number;
  pendingDeltaPitch: number;
  releaseVelYaw: number;
  releaseVelPitch: number;
  hasReleaseMomentum: boolean;
}

interface SharedWaveBuffer {
  localOrigins: THREE.Vector3[];
  worldOrigins: THREE.Vector3[];
  startTimes: number[];
  nextSlot: number;
}

interface LayerPointsProps {
  layerId: OrbLayerId;
  layerRole: number;
  layerConfig: LayerConfig;
  referenceRadius: number;
  effectiveParticleCount: number;
  config: OrbConfig;
  reducedMotion: boolean;
  globalParticleSizeRef: React.RefObject<number>;
  sharedTimeRef: React.RefObject<number>;
  sharedPointerWorldRef: React.RefObject<THREE.Vector3>;
  sharedPointerStrengthRef: React.RefObject<number>;
  sharedWavesRef: React.RefObject<SharedWaveBuffer>;
}

function createInitialWaveOrigins(): THREE.Vector3[] {
  return Array.from({ length: MAX_ACTIVE_WAVES }, () => new THREE.Vector3(0, 0, 1));
}

function VolumetricLayerPoints({
  layerId,
  layerRole,
  layerConfig,
  referenceRadius,
  effectiveParticleCount,
  config,
  reducedMotion,
  globalParticleSizeRef,
  sharedTimeRef,
  sharedPointerWorldRef,
  sharedPointerStrengthRef,
  sharedWavesRef,
}: LayerPointsProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  const layerAnimRef = useRef({
    animIntensity: layerConfig.animationIntensity,
    opacity: layerConfig.opacity,
    brightness: layerConfig.brightness,
  });

  const { gl, invalidate } = useThree();

  // Create & dispose custom GLSL ShaderMaterial once per layer
  useEffect(() => {
    const points = pointsRef.current;
    if (!points) return;

    const mat = new THREE.ShaderMaterial({
      vertexShader: orbVertexShader,
      fragmentShader: orbFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uLayerRadius: { value: layerConfig.radius },
        uReferenceRadius: { value: referenceRadius },
        uParticleSize: { value: globalParticleSizeRef.current },
        uLayerOpacity: { value: layerConfig.opacity },
        uLayerBrightness: { value: layerConfig.brightness },
        uPixelRatio: { value: gl.getPixelRatio() },
        uAnimationIntensity: { value: layerConfig.animationIntensity },
        uLayerRole: { value: layerRole },

        uPointerWorld: { value: new THREE.Vector3(0, 0, 0) },
        uPointerStrength: { value: 0 },

        uWaveOrigins: { value: createInitialWaveOrigins() },
        uWaveStartTimes: { value: new Array<number>(MAX_ACTIVE_WAVES).fill(-1) },
        uWaveSpeed: { value: config.wave.speed },
        uWaveAmplitude: { value: config.wave.amplitude },
        uWaveWidth: { value: config.wave.width },
        uWaveFrequency: { value: config.wave.frequency },
        uWaveDamping: { value: config.wave.damping },
        uWaveRecovery: { value: config.wave.recoveryRate },
        uLayerWaveResponse: { value: layerConfig.waveResponse },
        uLayerWaveDelay: { value: layerConfig.waveDelay },

        uColorHighlight: { value: new THREE.Color(config.colors.highlight) },
        uColorLightGray: { value: new THREE.Color(config.colors.lightGray) },
        uColorMidGray: { value: new THREE.Color(config.colors.midGray) },
        uColorCharcoal: { value: new THREE.Color(config.colors.charcoal) },
        uColorShadow: { value: new THREE.Color(config.colors.shadow) },
      },
    });

    materialRef.current = mat;
    points.material = mat;
    invalidate();

    return () => {
      mat.dispose();
      materialRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  const { radius } = layerConfig;

  // Rebuild & dispose layer BufferGeometry only when structural radius or count changes
  useEffect(() => {
    const points = pointsRef.current;
    if (!points) return;

    const nextGeometry = createLayerParticleGeometry({
      layerId,
      layer: {
        ...layerConfig,
        radius,
      },
      effectiveCount: effectiveParticleCount,
    });

    const previousGeometry = points.geometry;
    points.geometry = nextGeometry;
    if (previousGeometry) {
      previousGeometry.dispose();
    }
    invalidate();

    return () => {
      nextGeometry.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerId, effectiveParticleCount, radius, invalidate]);

  // Sync immediate uniforms for reduced-motion / demand renders
  useEffect(() => {
    const mat = materialRef.current;
    if (!mat) return;
    mat.uniforms.uLayerRadius.value = layerConfig.radius;
    mat.uniforms.uReferenceRadius.value = referenceRadius;
    mat.uniforms.uLayerWaveResponse.value = layerConfig.waveResponse;
    mat.uniforms.uLayerWaveDelay.value = layerConfig.waveDelay;
    mat.uniforms.uWaveSpeed.value = config.wave.speed;
    mat.uniforms.uWaveAmplitude.value = config.wave.amplitude;
    mat.uniforms.uWaveWidth.value = config.wave.width;
    mat.uniforms.uWaveFrequency.value = config.wave.frequency;
    mat.uniforms.uWaveDamping.value = config.wave.damping;
    mat.uniforms.uWaveRecovery.value = config.wave.recoveryRate;
    mat.uniforms.uParticleSize.value = config.particleSize;

    if (reducedMotion) {
      mat.uniforms.uLayerOpacity.value = layerConfig.opacity;
      mat.uniforms.uLayerBrightness.value = layerConfig.brightness;
      mat.uniforms.uColorHighlight.value.set(config.colors.highlight);
      mat.uniforms.uColorLightGray.value.set(config.colors.lightGray);
      mat.uniforms.uColorMidGray.value.set(config.colors.midGray);
      mat.uniforms.uColorCharcoal.value.set(config.colors.charcoal);
      mat.uniforms.uColorShadow.value.set(config.colors.shadow);
      invalidate();
    }
  }, [
    layerConfig,
    referenceRadius,
    config.particleSize,
    config.wave,
    config.colors,
    reducedMotion,
    invalidate,
  ]);

  useFrame((_, rawDelta) => {
    const mat = materialRef.current;
    if (!mat) return;

    const dt = Math.min(rawDelta, 0.05);
    const state = layerAnimRef.current;

    // Smoothly damp layer appearance & animation multipliers (zero independent rotation)
    const targetIntensity = reducedMotion ? 0 : layerConfig.animationIntensity;
    state.animIntensity = THREE.MathUtils.damp(state.animIntensity, targetIntensity, 6, dt);
    state.opacity = THREE.MathUtils.damp(state.opacity, layerConfig.opacity, 8, dt);
    state.brightness = THREE.MathUtils.damp(state.brightness, layerConfig.brightness, 8, dt);

    // Smooth monochrome palette interpolation
    const colorLerp = 1 - Math.exp(-8 * dt);
    mat.uniforms.uColorHighlight.value.lerp(_targetHighlight, colorLerp);
    mat.uniforms.uColorLightGray.value.lerp(_targetLightGray, colorLerp);
    mat.uniforms.uColorMidGray.value.lerp(_targetMidGray, colorLerp);
    mat.uniforms.uColorCharcoal.value.lerp(_targetCharcoal, colorLerp);
    mat.uniforms.uColorShadow.value.lerp(_targetShadow, colorLerp);

    // Copy shared fluid wave ring buffer to layer shader uniforms (zero allocation)
    const waveBuf = sharedWavesRef.current;
    const waveOriginUniforms = mat.uniforms.uWaveOrigins.value as THREE.Vector3[];
    const waveTimeUniforms = mat.uniforms.uWaveStartTimes.value as number[];
    for (let i = 0; i < MAX_ACTIVE_WAVES; i++) {
      waveOriginUniforms[i].copy(waveBuf.worldOrigins[i]);
      waveTimeUniforms[i] = waveBuf.startTimes[i];
    }

    // Push per-frame uniforms (shared clock, shared global size, shared pointer state)
    mat.uniforms.uTime.value = sharedTimeRef.current;
    mat.uniforms.uParticleSize.value = globalParticleSizeRef.current;
    mat.uniforms.uLayerOpacity.value = state.opacity;
    mat.uniforms.uLayerBrightness.value = state.brightness;
    mat.uniforms.uAnimationIntensity.value = state.animIntensity;
    mat.uniforms.uPointerWorld.value.copy(sharedPointerWorldRef.current);
    mat.uniforms.uPointerStrength.value = sharedPointerStrengthRef.current;
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio();
  });

  // Zero local offset or rotation: all three layers share the exact parent axis & orientation
  return <points ref={pointsRef} renderOrder={layerRole} frustumCulled={false} />;
}

interface VolumetricOrbMeshProps {
  config: OrbConfig;
  particleScale: number;
  reducedMotion: boolean;
  pointerRef: React.RefObject<PointerStateRef>;
  dragRef: React.RefObject<DragInteractionRef>;
  pendingClicksRef: React.RefObject<PendingWaveClick[]>;
}

export function VolumetricOrbMesh({
  config,
  particleScale,
  reducedMotion,
  pointerRef,
  dragRef,
  pendingClicksRef,
}: VolumetricOrbMeshProps) {
  const orbGroupRef = useRef<THREE.Group>(null);
  const { camera, size, invalidate } = useThree();

  const sharedTimeRef = useRef(0);
  const idleWeightRef = useRef(1.0);
  const globalParticleSizeRef = useRef(config.particleSize);
  const sharedPointerWorldRef = useRef(new THREE.Vector3(0, 0, 0));
  const sharedPointerStrengthRef = useRef(0);
  const hoverTiltRef = useRef({ x: 0, y: 0 });
  const momentumRef = useRef({ yaw: 0, pitch: 0 });

  const sharedWavesRef = useRef<SharedWaveBuffer>({
    localOrigins: createInitialWaveOrigins(),
    worldOrigins: createInitialWaveOrigins(),
    startTimes: new Array<number>(MAX_ACTIVE_WAVES).fill(-1),
    nextSlot: 0,
  });

  // Update target monochrome color stops
  useEffect(() => {
    _targetHighlight.set(config.colors.highlight);
    _targetLightGray.set(config.colors.lightGray);
    _targetMidGray.set(config.colors.midGray);
    _targetCharcoal.set(config.colors.charcoal);
    _targetShadow.set(config.colors.shadow);
  }, [config.colors]);

  // Sync global particle size immediately in reducedMotion/demand mode
  useEffect(() => {
    if (reducedMotion) {
      globalParticleSizeRef.current = config.particleSize;
      invalidate();
    }
  }, [config.particleSize, reducedMotion, invalidate]);

  // Responsive perspective camera framing for all three concentric layers
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const fovRad = THREE.MathUtils.degToRad(camera.fov * 0.5);
    const vTan = Math.tan(fovRad);
    const aspect = size.width / Math.max(1, size.height);

    const maxLayerRadius = Math.max(
      config.layers.inner.radius,
      config.layers.main.radius,
      config.layers.outer.radius
    );
    const targetExtent = Math.max(config.layers.main.radius * 1.62, maxLayerRadius * 1.38);
    const distV = targetExtent / vTan;
    const distH = targetExtent / (vTan * aspect);
    const idealDist = Math.max(distV, distH);

    camera.position.set(0, 0, idealDist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    invalidate();
  }, [
    camera,
    size.width,
    size.height,
    config.layers.inner.radius,
    config.layers.main.radius,
    config.layers.outer.radius,
    invalidate,
  ]);

  // Unified parent rotation (drag + momentum + idle + hover) + click raycasts for all three layers
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const motionFactor = reducedMotion ? 0 : 1;
    if (!reducedMotion) {
      sharedTimeRef.current += dt;
    }

    globalParticleSizeRef.current = THREE.MathUtils.damp(
      globalParticleSizeRef.current,
      config.particleSize,
      12,
      dt
    );

    const orbGroup = orbGroupRef.current;
    const drag = dragRef.current;
    const referenceRadius = config.layers.main.radius;

    // Unified hover pointer state
    const pointer = pointerRef.current;
    const isDragging = drag ? drag.isDragging : false;
    const pointerEnabled = config.pointerInteraction && !reducedMotion && !isDragging;

    if (pointerEnabled && pointer && pointer.active) {
      _ndc.set(pointer.x, pointer.y);
      _raycaster.setFromCamera(_ndc, camera);
      const hit = _raycaster.ray.intersectPlane(_plane, _intersect);
      if (hit) {
        sharedPointerWorldRef.current.lerp(_intersect, 1 - Math.exp(-10 * dt));
        const withinOrb = _intersect.length() < referenceRadius * 1.45 ? 1 : 0;
        sharedPointerStrengthRef.current = THREE.MathUtils.damp(
          sharedPointerStrengthRef.current,
          withinOrb,
          5.5,
          dt
        );
      }
    } else {
      sharedPointerStrengthRef.current = THREE.MathUtils.damp(
        sharedPointerStrengthRef.current,
        0,
        5.0,
        dt
      );
    }

    if (orbGroup && drag) {
      let stepYaw = 0;
      let stepPitch = 0;

      if (drag.isDragging) {
        stepYaw = drag.pendingDeltaYaw;
        stepPitch = drag.pendingDeltaPitch;
        drag.pendingDeltaYaw = 0;
        drag.pendingDeltaPitch = 0;
        momentumRef.current.yaw = 0;
        momentumRef.current.pitch = 0;
      } else {
        if (drag.hasReleaseMomentum) {
          momentumRef.current.yaw = drag.releaseVelYaw;
          momentumRef.current.pitch = drag.releaseVelPitch;
          drag.hasReleaseMomentum = false;
        }

        stepYaw += drag.pendingDeltaYaw;
        stepPitch += drag.pendingDeltaPitch;
        drag.pendingDeltaYaw = 0;
        drag.pendingDeltaPitch = 0;

        stepYaw += momentumRef.current.yaw * dt;
        stepPitch += momentumRef.current.pitch * dt;

        const dampingFactor = Math.exp(-3.1 * dt);
        momentumRef.current.yaw *= dampingFactor;
        momentumRef.current.pitch *= dampingFactor;

        if (Math.hypot(momentumRef.current.yaw, momentumRef.current.pitch) < 0.002) {
          momentumRef.current.yaw = 0;
          momentumRef.current.pitch = 0;
        }
      }

      const momentumSpeed = Math.hypot(momentumRef.current.yaw, momentumRef.current.pitch);
      const targetIdle = reducedMotion || drag.isDragging || momentumSpeed > 0.045 ? 0 : 1;
      idleWeightRef.current = THREE.MathUtils.damp(
        idleWeightRef.current,
        targetIdle,
        drag.isDragging ? 14 : 2.2,
        dt
      );

      // Subtle unified hover tilt delta
      const prevHoverX = hoverTiltRef.current.x;
      const prevHoverY = hoverTiltRef.current.y;
      const targetHoverY = pointerEnabled && pointer && pointer.active ? pointer.x * 0.14 : 0;
      const targetHoverX = pointerEnabled && pointer && pointer.active ? -pointer.y * 0.10 : 0;
      hoverTiltRef.current.y = THREE.MathUtils.damp(prevHoverY, targetHoverY, 3.6, dt);
      hoverTiltRef.current.x = THREE.MathUtils.damp(prevHoverX, targetHoverX, 3.6, dt);

      stepYaw += (hoverTiltRef.current.y - prevHoverY) * idleWeightRef.current;
      stepPitch += (hoverTiltRef.current.x - prevHoverX) * idleWeightRef.current;

      // Apply unified manual + momentum + hover rotation around world axes
      if (Math.abs(stepYaw) > 1e-6 || Math.abs(stepPitch) > 1e-6) {
        _dqY.setFromAxisAngle(_axisY, stepYaw);
        _dqX.setFromAxisAngle(_axisX, stepPitch);
        orbGroup.quaternion.premultiply(_dqY).premultiply(_dqX).normalize();
      }

      // Apply unified automatic idle rotation identically to all three layers
      const idleDelta = dt * config.rotationSpeed * motionFactor * idleWeightRef.current;
      if (Math.abs(idleDelta) > 1e-6) {
        _dqIdle.setFromAxisAngle(_axisY, idleDelta);
        orbGroup.quaternion.premultiply(_dqIdle).normalize();
      }
    }

    // Drain click queue for 3D fluid waves
    const queue = pendingClicksRef.current;
    if (queue && queue.length > 0) {
      if (config.wave.enabled && !reducedMotion) {
        _mainSphere.radius = config.layers.main.radius * 1.04;
        _outerSphere.radius = config.layers.outer.radius * 1.06;

        while (queue.length > 0) {
          const click = queue.shift();
          if (!click) continue;

          _ndc.set(click.ndcX, click.ndcY);
          _raycaster.setFromCamera(_ndc, camera);

          let matched = _raycaster.ray.intersectSphere(_mainSphere, _hitPoint) !== null;
          if (!matched) {
            matched = _raycaster.ray.intersectSphere(_outerSphere, _hitPoint) !== null;
          }
          if (!matched) {
            _raycaster.ray.closestPointToPoint(_origin, _closestPoint);
            if (_closestPoint.length() <= config.layers.outer.radius * 1.32) {
              _hitPoint.copy(_closestPoint);
              matched = true;
            }
          }

          if (matched && _hitPoint.lengthSq() > 0.0001) {
            const buf = sharedWavesRef.current;
            const slot = buf.nextSlot % MAX_ACTIVE_WAVES;
            buf.localOrigins[slot].copy(_hitPoint).normalize();
            if (orbGroup) {
              _invQuat.copy(orbGroup.quaternion).invert();
              buf.localOrigins[slot].applyQuaternion(_invQuat);
            }
            buf.startTimes[slot] = sharedTimeRef.current;
            buf.nextSlot = (buf.nextSlot + 1) % MAX_ACTIVE_WAVES;
          }
        }
      } else {
        queue.length = 0;
      }
    }

    // Keep active wave origins pinned to the unified rotated orb surface
    const buf = sharedWavesRef.current;
    for (let i = 0; i < MAX_ACTIVE_WAVES; i++) {
      if (buf.startTimes[i] >= 0) {
        buf.worldOrigins[i].copy(buf.localOrigins[i]);
        if (orbGroup) {
          buf.worldOrigins[i].applyQuaternion(orbGroup.quaternion);
        }
      }
    }
  });

  const referenceRadius = config.layers.main.radius;

  return (
    <group ref={orbGroupRef} position={[0, 0, 0]}>
      <VolumetricLayerPoints
        layerId="inner"
        layerRole={0}
        layerConfig={config.layers.inner}
        referenceRadius={referenceRadius}
        effectiveParticleCount={Math.round(config.layers.inner.particleCount * particleScale)}
        config={config}
        reducedMotion={reducedMotion}
        globalParticleSizeRef={globalParticleSizeRef}
        sharedTimeRef={sharedTimeRef}
        sharedPointerWorldRef={sharedPointerWorldRef}
        sharedPointerStrengthRef={sharedPointerStrengthRef}
        sharedWavesRef={sharedWavesRef}
      />
      <VolumetricLayerPoints
        layerId="main"
        layerRole={1}
        layerConfig={config.layers.main}
        referenceRadius={referenceRadius}
        effectiveParticleCount={Math.round(config.layers.main.particleCount * particleScale)}
        config={config}
        reducedMotion={reducedMotion}
        globalParticleSizeRef={globalParticleSizeRef}
        sharedTimeRef={sharedTimeRef}
        sharedPointerWorldRef={sharedPointerWorldRef}
        sharedPointerStrengthRef={sharedPointerStrengthRef}
        sharedWavesRef={sharedWavesRef}
      />
      <VolumetricLayerPoints
        layerId="outer"
        layerRole={2}
        layerConfig={config.layers.outer}
        referenceRadius={referenceRadius}
        effectiveParticleCount={Math.round(config.layers.outer.particleCount * particleScale)}
        config={config}
        reducedMotion={reducedMotion}
        globalParticleSizeRef={globalParticleSizeRef}
        sharedTimeRef={sharedTimeRef}
        sharedPointerWorldRef={sharedPointerWorldRef}
        sharedPointerStrengthRef={sharedPointerStrengthRef}
        sharedWavesRef={sharedWavesRef}
      />
    </group>
  );
}
