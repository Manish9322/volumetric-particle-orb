'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import {
  COLOR_PRESETS,
  DEFAULT_ORB_CONFIG,
  type ColorPresetId,
  type LayerConfig,
  type OrbConfig,
  type OrbLayerId,
  type WaveConfig,
} from '@/lib/orb/types';

type DockTabId = OrbLayerId | 'wave';

interface OrbControlsDockProps {
  config: OrbConfig;
  onChange: (next: OrbConfig) => void;
  onReset: () => void;
}

interface SliderControlProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (value: number) => void;
}

function SliderControl({
  id,
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: SliderControlProps) {
  return (
    <div className="flex flex-col gap-1.5 min-w-[120px]">
      <div className="flex items-center justify-between gap-2 text-xs">
        <label htmlFor={id} className="text-neutral-400 font-medium whitespace-nowrap">
          {label}
        </label>
        <span className="font-mono tabular-nums text-neutral-100 text-[11px]">
          {displayValue}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-neutral-800 accent-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      />
    </div>
  );
}

const LAYER_BOUNDS: Record<
  OrbLayerId,
  {
    radiusMin: number;
    radiusMax: number;
    countMin: number;
    countMax: number;
    countStep: number;
  }
> = {
  inner: {
    radiusMin: 0.9,
    radiusMax: 1.75,
    countMin: 2000,
    countMax: 10000,
    countStep: 250,
  },
  main: {
    radiusMin: 1.8,
    radiusMax: 2.9,
    countMin: 3000,
    countMax: 14000,
    countStep: 500,
  },
  outer: {
    radiusMin: 2.5,
    radiusMax: 3.4,
    countMin: 1000,
    countMax: 6000,
    countStep: 250,
  },
};

const TABS: { id: DockTabId; label: string }[] = [
  { id: 'inner', label: 'Inner Core' },
  { id: 'main', label: 'Main Shell' },
  { id: 'outer', label: 'Outer Sphere' },
  { id: 'wave', label: 'Fluid Wave' },
];

export function OrbControlsDock({ config, onChange, onReset }: OrbControlsDockProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DockTabId>('main');

  // Toggle dock with 'H' key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'h' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const updateLayerField = <K extends keyof LayerConfig>(
    layerId: OrbLayerId,
    key: K,
    value: LayerConfig[K]
  ) => {
    onChange({
      ...config,
      layers: {
        ...config.layers,
        [layerId]: {
          ...config.layers[layerId],
          [key]: value,
        },
      },
    });
  };

  const updateWaveField = <K extends keyof WaveConfig>(key: K, value: WaveConfig[K]) => {
    onChange({
      ...config,
      wave: {
        ...config.wave,
        [key]: value,
      },
    });
  };

  const handlePresetChange = (presetId: ColorPresetId) => {
    onChange({
      ...config,
      colorPreset: presetId,
      colors: COLOR_PRESETS[presetId].colors,
    });
  };

  const isModified = JSON.stringify(config) !== JSON.stringify(DEFAULT_ORB_CONFIG);

  const renderLayerSliders = (layerId: OrbLayerId) => {
    const layer = config.layers[layerId];
    const bounds = LAYER_BOUNDS[layerId];

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-5 gap-y-3 items-center">
        <SliderControl
          id={`ctrl-${layerId}-radius`}
          label="Radius"
          value={layer.radius}
          min={bounds.radiusMin}
          max={bounds.radiusMax}
          step={0.05}
          displayValue={layer.radius.toFixed(2)}
          onChange={(v) => updateLayerField(layerId, 'radius', v)}
        />
        <SliderControl
          id={`ctrl-${layerId}-count`}
          label="Particles"
          value={layer.particleCount}
          min={bounds.countMin}
          max={bounds.countMax}
          step={bounds.countStep}
          displayValue={`${(layer.particleCount / 1000).toFixed(1)}k`}
          onChange={(v) => updateLayerField(layerId, 'particleCount', v)}
        />
        <SliderControl
          id={`ctrl-${layerId}-opacity`}
          label="Opacity"
          value={layer.opacity}
          min={0.1}
          max={1.2}
          step={0.05}
          displayValue={`${Math.round(layer.opacity * 100)}%`}
          onChange={(v) => updateLayerField(layerId, 'opacity', v)}
        />
        <SliderControl
          id={`ctrl-${layerId}-brightness`}
          label="Brightness"
          value={layer.brightness}
          min={0.25}
          max={1.6}
          step={0.05}
          displayValue={`${layer.brightness.toFixed(2)}x`}
          onChange={(v) => updateLayerField(layerId, 'brightness', v)}
        />
        <SliderControl
          id={`ctrl-${layerId}-motion`}
          label="Motion"
          value={layer.animationIntensity}
          min={0}
          max={2.0}
          step={0.05}
          displayValue={`${layer.animationIntensity.toFixed(2)}x`}
          onChange={(v) => updateLayerField(layerId, 'animationIntensity', v)}
        />
        <SliderControl
          id={`ctrl-${layerId}-wave`}
          label="Wave Response"
          value={layer.waveResponse}
          min={0}
          max={1.6}
          step={0.05}
          displayValue={`${layer.waveResponse.toFixed(2)}x`}
          onChange={(v) => updateLayerField(layerId, 'waveResponse', v)}
        />
      </div>
    );
  };

  const renderWaveSliders = () => {
    const w = config.wave;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-5 gap-y-3 items-center">
        <SliderControl
          id="ctrl-wave-speed"
          label="Wave Speed"
          value={w.speed}
          min={0.8}
          max={4.0}
          step={0.05}
          displayValue={`${w.speed.toFixed(2)} r/s`}
          onChange={(v) => updateWaveField('speed', v)}
        />
        <SliderControl
          id="ctrl-wave-amp"
          label="Amplitude"
          value={w.amplitude}
          min={0.05}
          max={0.6}
          step={0.02}
          displayValue={w.amplitude.toFixed(2)}
          onChange={(v) => updateWaveField('amplitude', v)}
        />
        <SliderControl
          id="ctrl-wave-width"
          label="Wave Width"
          value={w.width}
          min={0.2}
          max={1.1}
          step={0.02}
          displayValue={w.width.toFixed(2)}
          onChange={(v) => updateWaveField('width', v)}
        />
        <SliderControl
          id="ctrl-wave-freq"
          label="Frequency"
          value={w.frequency}
          min={3.0}
          max={16.0}
          step={0.5}
          displayValue={w.frequency.toFixed(1)}
          onChange={(v) => updateWaveField('frequency', v)}
        />
        <SliderControl
          id="ctrl-wave-damping"
          label="Damping"
          value={w.damping}
          min={0.35}
          max={2.4}
          step={0.05}
          displayValue={w.damping.toFixed(2)}
          onChange={(v) => updateWaveField('damping', v)}
        />
        <SliderControl
          id="ctrl-wave-recovery"
          label="Recovery"
          value={w.recoveryRate}
          min={0.4}
          max={2.6}
          step={0.05}
          displayValue={w.recoveryRate.toFixed(2)}
          onChange={(v) => updateWaveField('recoveryRate', v)}
        />
      </div>
    );
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[min(940px,94vw)] w-max pointer-events-none">
      {/* Collapse / Expand toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="orb-controls-panel"
        className="pointer-events-auto inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-white/15 bg-[#0c0c0c]/95 text-xs font-medium text-neutral-300 hover:text-white hover:border-white/35 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {isOpen ? (
          <>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-200" aria-hidden="true" />
            <span>Hide Controls</span>
          </>
        ) : (
          <>
            <ChevronUp className="w-3.5 h-3.5 text-neutral-200" aria-hidden="true" />
            <span>Tune Orb</span>
          </>
        )}
      </button>

      {/* Collapsible tabbed bottom dock */}
      {isOpen && (
        <div
          id="orb-controls-panel"
          className="pointer-events-auto mt-2 w-[min(920px,94vw)] rounded-xl border border-white/15 bg-[#0a0a0a]/95 px-4 py-3.5 shadow-2xl"
        >
          {/* Top Row: Layer/Wave Tabs + Global Particle Size & Unified Rotation + Wave Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-white/10">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-900/90 border border-white/5 overflow-x-auto">
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                      active
                        ? 'bg-white/15 text-white border border-white/35'
                        : 'text-neutral-400 border border-transparent hover:text-neutral-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="min-w-[138px]">
                <SliderControl
                  id="ctrl-global-particle-size"
                  label="Particle Size"
                  value={config.particleSize}
                  min={0.25}
                  max={2.0}
                  step={0.05}
                  displayValue={`${config.particleSize.toFixed(2)}x`}
                  onChange={(v) => onChange({ ...config, particleSize: v })}
                />
              </div>

              <div className="min-w-[138px]">
                <SliderControl
                  id="ctrl-global-rotation"
                  label="Rotation"
                  value={config.rotationSpeed}
                  min={0}
                  max={0.2}
                  step={0.004}
                  displayValue={config.rotationSpeed.toFixed(3)}
                  onChange={(v) => onChange({ ...config, rotationSpeed: v })}
                />
              </div>

              <button
                type="button"
                onClick={() => updateWaveField('enabled', !config.wave.enabled)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  config.wave.enabled
                    ? 'bg-white/15 text-white border-white/35'
                    : 'bg-neutral-900 text-neutral-400 border-white/5 hover:text-neutral-200'
                }`}
              >
                Click Wave: {config.wave.enabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          {/* Active Tab Controls */}
          {activeTab === 'wave' ? renderWaveSliders() : renderLayerSliders(activeTab)}

          {/* Global Palette & Actions Footer */}
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-neutral-400 font-medium mr-1">Shades</span>
              {(Object.keys(COLOR_PRESETS) as ColorPresetId[]).map((id) => {
                const preset = COLOR_PRESETS[id];
                const active = config.colorPreset === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handlePresetChange(id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                      active
                        ? 'bg-white/15 text-white border border-white/40'
                        : 'bg-neutral-900 text-neutral-400 border border-white/5 hover:text-neutral-200'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0 border border-white/25"
                      style={{ backgroundColor: preset.colors.lightGray }}
                      aria-hidden="true"
                    />
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onChange({ ...config, pointerInteraction: !config.pointerInteraction })
                }
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  config.pointerInteraction
                    ? 'bg-white/15 text-white border-white/40'
                    : 'bg-neutral-900 text-neutral-400 border-white/5 hover:text-neutral-200'
                }`}
              >
                Hover Tilt: {config.pointerInteraction ? 'On' : 'Off'}
              </button>

              <button
                type="button"
                onClick={onReset}
                disabled={!isModified}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-900 text-neutral-300 border border-white/10 hover:text-white hover:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
