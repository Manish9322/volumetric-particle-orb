export interface OrbColorStops {
  /** Pure bright white highlight on the peak upper-left illuminated region */
  highlight: string;
  /** Luminous silver across upper-left illuminated faces */
  lightGray: string;
  /** Balanced mid-silver across the primary body */
  midGray: string;
  /** Cool slate gray transitioning into the shadowed hemisphere */
  charcoal: string;
  /** Deep graphite in the shadowed lower-right region */
  shadow: string;
}

export type ColorPresetId = 'lunar' | 'chrome' | 'graphite';
export type OrbLayerId = 'inner' | 'main' | 'outer';

export interface LayerConfig {
  /** Radius of this spherical layer (world units) */
  radius: number;
  /** Total randomly distributed particles across this layer's shell and sparse interior */
  particleCount: number;
  /** Overall layer opacity multiplier */
  opacity: number;
  /** Overall layer brightness multiplier */
  brightness: number;
  /** Organic animation & shimmer intensity multiplier */
  animationIntensity: number;
  /** Layer-specific click-wave displacement/luminance intensity */
  waveResponse: number;
  /** Temporal phase delay (seconds) for wave arrival on this layer */
  waveDelay: number;
}

export interface WaveConfig {
  /** Enable click/tap triggered fluid wave */
  enabled: boolean;
  /** Geodesic propagation speed across the sphere (radians/sec) */
  speed: number;
  /** Peak radial & tangential particle displacement amplitude */
  amplitude: number;
  /** Spatial Gaussian width of the travelling wavefront (radians) */
  width: number;
  /** Spatial wave ripple frequency */
  frequency: number;
  /** Exponential damping factor over wave travel */
  damping: number;
  /** Smooth elastic recovery tail rate */
  recoveryRate: number;
}

export interface OrbConfig {
  /** Global unified particle size multiplier applied identically across all three layers */
  particleSize: number;
  /** Unified automatic idle rotation speed shared identically by all three layers (rad/sec) */
  rotationSpeed: number;
  /** Three concentric spherical particle layers sharing one central axis & orientation */
  layers: Record<OrbLayerId, LayerConfig>;
  /** Click-triggered 3D fluid wave configuration */
  wave: WaveConfig;
  /** Color preset identifier */
  colorPreset: ColorPresetId;
  /** Custom monochrome color distribution stops */
  colors: OrbColorStops;
  /** Enable subtle hover pointer tilt and local displacement */
  pointerInteraction: boolean;
}

export const COLOR_PRESETS: Record<ColorPresetId, { label: string; colors: OrbColorStops }> = {
  lunar: {
    label: 'Lunar Silver',
    colors: {
      highlight: '#FFFFFF',
      lightGray: '#E5E5E5',
      midGray: '#A3A3A3',
      charcoal: '#525252',
      shadow: '#1F1F1F',
    },
  },
  chrome: {
    label: 'Pure Chrome',
    colors: {
      highlight: '#FFFFFF',
      lightGray: '#F2F2F2',
      midGray: '#C2C2C2',
      charcoal: '#6E6E6E',
      shadow: '#2B2B2B',
    },
  },
  graphite: {
    label: 'Smoked Graphite',
    colors: {
      highlight: '#F4F4F5',
      lightGray: '#CCCCCC',
      midGray: '#828282',
      charcoal: '#404040',
      shadow: '#171717',
    },
  },
};

export const BASE_ORB_RADIUS = 2.4;

export const DEFAULT_ORB_CONFIG: OrbConfig = {
  particleSize: 0.5,
  rotationSpeed: 0.048,
  layers: {
    // Layer 1: Inner Dense Orb (~58% of main radius, shell-concentrated dense random core)
    inner: {
      radius: 1.4,
      particleCount: 5800,
      opacity: 0.96,
      brightness: 1.12,
      animationIntensity: 0.95,
      waveResponse: 0.72,
      waveDelay: 0.06,
    },
    // Layer 2: Main Orb (shell-concentrated random distribution, sparse interior)
    main: {
      radius: BASE_ORB_RADIUS,
      particleCount: 7800,
      opacity: 0.98,
      brightness: 1.10,
      animationIntensity: 1.0,
      waveResponse: 1.0,
      waveDelay: 0.0,
    },
    // Layer 3: Outer Atmospheric Sphere (~120% of main radius, lightly populated outer shell)
    outer: {
      radius: 2.88,
      particleCount: 3000,
      opacity: 0.70,
      brightness: 0.90,
      animationIntensity: 1.0,
      waveResponse: 0.58,
      waveDelay: 0.13,
    },
  },
  wave: {
    enabled: true,
    speed: 2.05,
    amplitude: 0.28,
    width: 0.52,
    frequency: 8.5,
    damping: 1.05,
    recoveryRate: 1.25,
  },
  colorPreset: 'lunar',
  colors: COLOR_PRESETS.lunar.colors,
  pointerInteraction: true,
};
