'use client';

import { useEffect, useState } from 'react';

export interface DeviceCapabilities {
  isSoftwareGl: boolean;
  prefersReducedMotion: boolean;
  isCompactViewport: boolean;
  recommendedParticleScale: number;
  maxDpr: number;
}

function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const rendererStr = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
  } catch {
    return false;
  }
}

export function useDeviceCapabilities(): DeviceCapabilities {
  const [caps, setCaps] = useState<DeviceCapabilities>({
    isSoftwareGl: false,
    prefersReducedMotion: false,
    isCompactViewport: false,
    recommendedParticleScale: 1,
    maxDpr: 2,
  });

  useEffect(() => {
    const isSoftwareGl = detectSoftwareWebGL();
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const computeCaps = () => {
      const width = window.innerWidth;
      const isCompact = width < 768;
      const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : 8;

      let particleScale = 1;
      if (isCompact) {
        particleScale = 0.85;
      } else if (cores <= 4 && !isSoftwareGl) {
        particleScale = 0.9;
      }

      setCaps({
        isSoftwareGl,
        prefersReducedMotion: motionQuery.matches,
        isCompactViewport: isCompact,
        recommendedParticleScale: particleScale,
        maxDpr: isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
      });
    };

    computeCaps();

    motionQuery.addEventListener('change', computeCaps);
    window.addEventListener('resize', computeCaps);
    return () => {
      motionQuery.removeEventListener('change', computeCaps);
      window.removeEventListener('resize', computeCaps);
    };
  }, []);

  return caps;
}
