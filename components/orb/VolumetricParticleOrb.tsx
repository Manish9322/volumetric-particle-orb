'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useDeviceCapabilities } from '@/lib/orb/useDeviceCapabilities';
import type { OrbConfig } from '@/lib/orb/types';
import {
  VolumetricOrbMesh,
  type DragInteractionRef,
  type PendingWaveClick,
  type PointerStateRef,
} from './VolumetricOrbMesh';

const DRAG_THRESHOLD_PX_SQ = 36; // 6px movement distinguishes drag from click/tap
const MAX_RELEASE_ANGULAR_SPEED = 6.0;

interface SoftwareFramePacerProps {
  isSoftwareGl: boolean;
  reducedMotion: boolean;
}

/**
 * On software WebGL (e.g. SwiftShader/llvmpipe), pace continuous frames using a
 * WebGL2 fenceSync + afterDraw pause so the CPU renderer never starves the UI thread.
 */
function SoftwareFramePacer({ isSoftwareGl, reducedMotion }: SoftwareFramePacerProps) {
  const { gl, invalidate } = useThree();

  useEffect(() => {
    if (!isSoftwareGl || reducedMotion) return;

    let cancelled = false;
    let timerId = 0;

    const scheduleNext = () => {
      if (cancelled) return;
      const context = gl.getContext() as WebGL2RenderingContext | null;
      if (context && typeof context.fenceSync === 'function') {
        const sync = context.fenceSync(context.SYNC_GPU_COMMANDS_COMPLETE, 0);
        context.flush();
        const poll = () => {
          if (cancelled) {
            if (sync) context.deleteSync(sync);
            return;
          }
          const status = sync
            ? context.getSyncParameter(sync, context.SYNC_STATUS)
            : context.SIGNALED;
          if (status === context.UNSIGNALED) {
            timerId = window.setTimeout(poll, 5);
          } else {
            if (sync) context.deleteSync(sync);
            timerId = window.setTimeout(() => {
              if (!cancelled) {
                invalidate();
                scheduleNext();
              }
            }, 80);
          }
        };
        timerId = window.setTimeout(poll, 5);
      } else {
        timerId = window.setTimeout(() => {
          if (!cancelled) {
            invalidate();
            scheduleNext();
          }
        }, 90);
      }
    };

    invalidate();
    scheduleNext();

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [gl, invalidate, isSoftwareGl, reducedMotion]);

  return null;
}

export interface VolumetricParticleOrbProps {
  config: OrbConfig;
  className?: string;
}

export function VolumetricParticleOrb({ config, className = '' }: VolumetricParticleOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<PointerStateRef>({ x: 0, y: 0, active: false });
  const pendingClicksRef = useRef<PendingWaveClick[]>([]);
  const dragRef = useRef<DragInteractionRef>({
    isDragging: false,
    pendingDeltaYaw: 0,
    pendingDeltaPitch: 0,
    releaseVelYaw: 0,
    releaseVelPitch: 0,
    hasReleaseMomentum: false,
  });

  const gestureRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    velYaw: number;
    velPitch: number;
    isDragging: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    velYaw: 0,
    velPitch: 0,
    isDragging: false,
  });

  const [isGrabbing, setIsGrabbing] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const caps = useDeviceCapabilities();

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported
    }

    const now = performance.now();
    gestureRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      lastTime: now,
      velYaw: 0,
      velPitch: 0,
      isDragging: false,
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const gesture = gestureRef.current;

    if (gesture.pointerId === e.pointerId) {
      const totalDx = e.clientX - gesture.startX;
      const totalDy = e.clientY - gesture.startY;
      const now = performance.now();

      if (!gesture.isDragging) {
        if (totalDx * totalDx + totalDy * totalDy > DRAG_THRESHOLD_PX_SQ) {
          gesture.isDragging = true;
          gesture.lastX = e.clientX;
          gesture.lastY = e.clientY;
          gesture.lastTime = now;
          gesture.velYaw = 0;
          gesture.velPitch = 0;

          dragRef.current.isDragging = true;
          dragRef.current.hasReleaseMomentum = false;
          dragRef.current.releaseVelYaw = 0;
          dragRef.current.releaseVelPitch = 0;
          pointerRef.current.active = false;
          setIsGrabbing(true);
        }
        return;
      }

      const dt = Math.max(0.004, Math.min(0.1, (now - gesture.lastTime) / 1000));
      const dx = e.clientX - gesture.lastX;
      const dy = e.clientY - gesture.lastY;

      const minDim = Math.max(240, Math.min(rect.width, rect.height));
      const sensitivity = 3.2 / minDim;

      const deltaYaw = dx * sensitivity;
      const deltaPitch = dy * sensitivity;

      dragRef.current.pendingDeltaYaw += deltaYaw;
      dragRef.current.pendingDeltaPitch += deltaPitch;

      const instVelYaw = deltaYaw / dt;
      const instVelPitch = deltaPitch / dt;
      gesture.velYaw = gesture.velYaw * 0.52 + instVelYaw * 0.48;
      gesture.velPitch = gesture.velPitch * 0.52 + instVelPitch * 0.48;

      gesture.lastX = e.clientX;
      gesture.lastY = e.clientY;
      gesture.lastTime = now;
      return;
    }

    // Passive hover tracking (desktop non-touch only)
    if (e.pointerType !== 'touch') {
      pointerRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      pointerRef.current.active = true;
    }
  }, []);

  const finishGesture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, allowClickWave: boolean) => {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore if capture already released
      }

      const gesture = gestureRef.current;
      if (gesture.pointerId !== e.pointerId) return;

      if (gesture.isDragging) {
        const now = performance.now();
        const pauseMs = now - gesture.lastTime;
        const recency = Math.max(0, 1 - pauseMs / 130);

        dragRef.current.releaseVelYaw = THREE.MathUtils.clamp(
          gesture.velYaw * recency,
          -MAX_RELEASE_ANGULAR_SPEED,
          MAX_RELEASE_ANGULAR_SPEED
        );
        dragRef.current.releaseVelPitch = THREE.MathUtils.clamp(
          gesture.velPitch * recency,
          -MAX_RELEASE_ANGULAR_SPEED,
          MAX_RELEASE_ANGULAR_SPEED
        );
        dragRef.current.hasReleaseMomentum = true;
        dragRef.current.isDragging = false;
        setIsGrabbing(false);
      } else if (allowClickWave) {
        const el = containerRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            pendingClicksRef.current.push({ ndcX, ndcY });
          }
        }
      }

      gesture.pointerId = null;
      gesture.isDragging = false;
    },
    []
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      finishGesture(e, true);
    },
    [finishGesture]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      finishGesture(e, false);
    },
    [finishGesture]
  );

  const handlePointerLeave = useCallback(() => {
    if (!gestureRef.current.isDragging) {
      pointerRef.current.active = false;
    }
  }, []);

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.14;
    gl.setClearColor(0x000000, 1);

    const canvas = gl.domElement;
    const onLost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => {
      setContextLost(false);
    };
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);
  }, []);

  const frameloopMode = caps.prefersReducedMotion || caps.isSoftwareGl ? 'demand' : 'always';

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      className={`relative w-full h-full bg-black overflow-hidden select-none touch-none ${
        isGrabbing ? 'cursor-grabbing' : 'cursor-grab'
      } ${className}`}
      aria-label="Interactive three-layer monochrome volumetric particle orb. Drag to freely rotate in 3D, or click to trigger a fluid wave."
      role="img"
    >
      {contextLost ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black text-neutral-100 text-sm">
          <div className="text-center space-y-2 px-6">
            <p className="font-medium">WebGL rendering context interrupted</p>
            <p className="text-xs text-neutral-400">
              Waiting for GPU context restoration.
            </p>
          </div>
        </div>
      ) : (
        <Canvas
          frameloop={frameloopMode}
          dpr={caps.isSoftwareGl ? 1 : [1, caps.maxDpr]}
          camera={{ fov: 42, near: 0.1, far: 100, position: [0, 0, 10.4] }}
          gl={{
            antialias: !caps.isSoftwareGl,
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
            depth: false,
          }}
          onCreated={handleCreated}
          style={{ width: '100%', height: '100%', display: 'block', background: '#000000' }}
        >
          <color attach="background" args={['#000000']} />
          <VolumetricOrbMesh
            config={config}
            particleScale={caps.recommendedParticleScale}
            reducedMotion={caps.prefersReducedMotion}
            pointerRef={pointerRef}
            dragRef={dragRef}
            pendingClicksRef={pendingClicksRef}
          />
          <SoftwareFramePacer
            isSoftwareGl={caps.isSoftwareGl}
            reducedMotion={caps.prefersReducedMotion}
          />
        </Canvas>
      )}
    </div>
  );
}
