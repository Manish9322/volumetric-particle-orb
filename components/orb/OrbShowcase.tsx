'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { DEFAULT_ORB_CONFIG, type OrbConfig } from '@/lib/orb/types';
import { VolumetricParticleOrb } from './VolumetricParticleOrb';
import { OrbControlsDock } from './OrbControlsDock';

export function OrbShowcase() {
  const [config, setConfig] = useState<OrbConfig>(DEFAULT_ORB_CONFIG);

  return (
    <main className="relative w-full h-dvh min-h-[540px] bg-black text-white overflow-hidden">
      {/* Unobstructed full-viewport 3D volumetric particle orb */}
      <div className="absolute inset-0 z-0">
        <VolumetricParticleOrb config={config} />
      </div>

      {/* Minimal top-left title overlay */}
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 pointer-events-none px-6 pt-5 sm:px-8 sm:pt-6 max-w-md"
      >
        <h1 className="text-base sm:text-lg font-semibold tracking-tight text-white/95">
          Volumetric Particle Orb
        </h1>
        <p className="mt-0.5 text-xs sm:text-[13px] text-neutral-400">
          Three-Layer Monochrome Particle Sphere · Drag to rotate, click for wave
        </p>
      </motion.header>

      {/* Collapsible bottom control dock */}
      <OrbControlsDock
        config={config}
        onChange={setConfig}
        onReset={() => setConfig(DEFAULT_ORB_CONFIG)}
      />
    </main>
  );
}
