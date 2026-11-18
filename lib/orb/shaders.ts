export const MAX_ACTIVE_WAVES = 6;

export const orbVertexShader = /* glsl */ `
  #define MAX_WAVES 6

  uniform float uTime;
  uniform float uLayerRadius;
  uniform float uReferenceRadius;
  uniform float uParticleSize;
  uniform float uLayerOpacity;
  uniform float uLayerBrightness;
  uniform float uPixelRatio;
  uniform float uAnimationIntensity;
  uniform float uLayerRole; // 0.0 = inner, 1.0 = main, 2.0 = outer

  uniform vec3 uPointerWorld;
  uniform float uPointerStrength;

  // Multi-wave fluid propagation uniforms
  uniform vec3 uWaveOrigins[MAX_WAVES];
  uniform float uWaveStartTimes[MAX_WAVES];
  uniform float uWaveSpeed;
  uniform float uWaveAmplitude;
  uniform float uWaveWidth;
  uniform float uWaveFrequency;
  uniform float uWaveDamping;
  uniform float uWaveRecovery;
  uniform float uLayerWaveResponse;
  uniform float uLayerWaveDelay;

  uniform vec3 uColorHighlight;
  uniform vec3 uColorLightGray;
  uniform vec3 uColorMidGray;
  uniform vec3 uColorCharcoal;
  uniform vec3 uColorShadow;

  attribute vec4 aParams;  // x: brightnessSeed, y: shimmerPhase, z: noisePhase, w: zone (1=shell, 0=interior)
  attribute vec4 aNoise;   // x: shimmerSpeed, y: colorBias, z: motionSpeed, w: radialNorm

  varying vec3 vColor;
  varying float vAlpha;

  // Compact 3D Simplex Noise (Ashima Arts) for smooth, pattern-free organic turbulence
  vec4 permute(vec4 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
  }
  vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
  }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 1.0 / 7.0;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  void main() {
    float brightnessSeed = aParams.x;
    float shimmerPhase = aParams.y;
    float noisePhase = aParams.z;
    float zone = aParams.w;

    float shimmerSpeed = aNoise.x;
    float colorBias = aNoise.y;
    float motionSpeed = aNoise.z;
    float radialNorm = aNoise.w;

    vec3 basePos = position;
    float baseLen = length(basePos);
    vec3 baseDir = baseLen > 0.0001 ? basePos / baseLen : vec3(0.0, 1.0, 0.0);

    // 1. Organic 3D simplex-noise drift constrained tightly to each particle's shell/radial zone
    float isInterior = 1.0 - step(0.5, zone);
    float zoneMotionScale = mix(1.0, 0.40, isInterior);

    vec3 noiseCoord = baseDir * 1.45 + vec3(uTime * 0.16 * motionSpeed + noisePhase * 0.08);
    vec3 noiseDisp = vec3(
      snoise(noiseCoord),
      snoise(noiseCoord + vec3(13.7, 5.2, 8.9)),
      snoise(noiseCoord + vec3(27.1, 19.4, 3.3))
    );

    float radialNoise = dot(noiseDisp, baseDir);
    vec3 tangentNoise = noiseDisp - baseDir * radialNoise;

    float motionAmp = uLayerRadius * 0.022 * zoneMotionScale * uAnimationIntensity;
    float radialBreath = radialNoise * uLayerRadius * 0.008 * zoneMotionScale * uAnimationIntensity;

    vec3 displacedPos = basePos + tangentNoise * motionAmp + baseDir * radialBreath;

    if (baseLen > 0.0001) {
      float newLen = length(displacedPos);
      if (newLen > 0.0001) {
        displacedPos = (displacedPos / newLen) * (baseLen + radialBreath * 0.55);
      }
    }

    // 2. Transform to world space for pointer interaction, click waves & world lighting
    vec4 worldPos4 = modelMatrix * vec4(displacedPos, 1.0);
    vec3 worldPos = worldPos4.xyz;
    float baseWorldLen = length(worldPos);
    vec3 worldDir = baseWorldLen > 0.0001 ? worldPos / baseWorldLen : vec3(0.0, 1.0, 0.0);

    // 3. Click-triggered multi-wave 3D geodesic fluid propagation (temporarily deforms, then recovers)
    float zoneWaveScale = mix(1.0, 0.45, isInterior);
    vec3 totalWaveDisp = vec3(0.0);
    float totalWaveLuminance = 0.0;

    for (int i = 0; i < MAX_WAVES; i++) {
      float startTime = uWaveStartTimes[i];
      if (startTime >= 0.0) {
        float elapsed = uTime - startTime - uLayerWaveDelay;
        if (elapsed > 0.0 && elapsed < 5.5) {
          vec3 originDir = normalize(uWaveOrigins[i]);
          float cosAngle = clamp(dot(worldDir, originDir), -1.0, 1.0);
          float geodesicAngle = acos(cosAngle);

          float geoDist = geodesicAngle + abs(radialNorm - 1.0) * 0.16;
          float frontAngle = elapsed * max(0.2, uWaveSpeed);
          float distFromFront = geoDist - frontAngle;

          float w = max(0.12, uWaveWidth);
          float envelope = exp(-(distFromFront * distFromFront) / (2.0 * w * w));
          float crestEnvelope = exp(-(distFromFront * distFromFront) / (2.0 * (w * 0.62) * (w * 0.62)));

          float attack = smoothstep(0.0, 0.085, elapsed);
          float travelDecay = exp(-elapsed * max(0.15, uWaveDamping));
          float recoveryTail = exp(-elapsed * max(0.15, uWaveRecovery) * 0.65);
          float dampingEnv = attack * mix(travelDecay, recoveryTail, 0.35);

          float wavePhase = distFromFront * uWaveFrequency;
          float radialOsc = cos(wavePhase);
          float tangOsc = sin(wavePhase);

          vec3 rawTang = worldDir - originDir * cosAngle;
          float tangLen = length(rawTang);
          vec3 tangentDir = tangLen > 0.0005 ? rawTang / tangLen : vec3(0.0);
          vec3 swirlDir = tangLen > 0.0005 ? cross(worldDir, tangentDir) : vec3(0.0);

          float localAmp = uWaveAmplitude * uLayerWaveResponse * zoneWaveScale * envelope * dampingEnv;
          totalWaveDisp += worldDir * (radialOsc * localAmp);
          totalWaveDisp += tangentDir * (tangOsc * localAmp * 0.68);
          totalWaveDisp += swirlDir * (sin(wavePhase * 0.7) * localAmp * 0.22);

          totalWaveLuminance += crestEnvelope * dampingEnv * uLayerWaveResponse * mix(1.0, 0.6, isInterior);
        }
      }
    }

    float dispMag = length(totalWaveDisp);
    float maxSafeDisp = uReferenceRadius * 0.22;
    if (dispMag > 0.0001) {
      float saturatedMag = maxSafeDisp * (dispMag / (dispMag + maxSafeDisp));
      worldPos += (totalWaveDisp / dispMag) * saturatedMag;
    }

    // 4. Subtle hover pointer displacement in world space (kept separate from clicks)
    if (uPointerStrength > 0.001) {
      vec3 toParticle = worldPos - uPointerWorld;
      float distToPointer = length(toParticle);
      float influenceRadius = uReferenceRadius * 0.58;
      float falloff = exp(-(distToPointer * distToPointer) / (influenceRadius * influenceRadius * 0.42));
      vec3 pushDir = distToPointer > 0.001 ? normalize(toParticle) : vec3(0.0, 0.0, 1.0);
      float hoverScale = (uLayerRole > 1.5 ? 0.07 : (uLayerRole < 0.5 ? 0.045 : 0.10)) * zoneWaveScale;
      worldPos += pushDir * falloff * uPointerStrength * uReferenceRadius * hoverScale;
    }

    // 5. View space position
    vec4 mvPosition = viewMatrix * vec4(worldPos, 1.0);
    vec4 centerViewPos = viewMatrix * vec4(0.0, 0.0, 0.0, 1.0);

    // 6. World-space asymmetric directional lighting (upper-left-front key light)
    float finalWorldLen = length(worldPos);
    vec3 sphereDir = finalWorldLen > 0.0001 ? worldPos / finalWorldLen : vec3(0.0, 1.0, 0.0);
    vec3 keyLightDir = normalize(vec3(-0.78, 0.56, 0.36));
    float ndotl = dot(sphereDir, keyLightDir);

    float lightFactor = clamp(0.54 + ndotl * 0.50 + colorBias * 0.28, 0.0, 1.0);
    float crescentHighlight = pow(max(0.0, ndotl), 2.1);

    // 7. Luminous white-to-graphite monochrome interpolation across 5 stops
    vec3 col = mix(uColorShadow, uColorCharcoal, smoothstep(0.02, 0.34, lightFactor));
    col = mix(col, uColorMidGray, smoothstep(0.24, 0.58, lightFactor));
    col = mix(col, uColorLightGray, smoothstep(0.54, 0.84, lightFactor));
    col = mix(col, uColorHighlight, clamp(smoothstep(0.80, 1.0, lightFactor) * 0.78 + crescentHighlight * 0.58, 0.0, 1.0));

    float waveGlow = clamp(totalWaveLuminance, 0.0, 1.35);
    col = mix(col, uColorHighlight, clamp(waveGlow * 0.36, 0.0, 0.48));

    // 8. Depth-aware intensity (front hemisphere bright, far side softly shadowed)
    float relViewZ = (mvPosition.z - centerViewPos.z) / max(0.5, uLayerRadius);
    float depthFactor = mix(0.34, 1.16, smoothstep(-1.0, 0.85, relViewZ));

    float rimFresnel = pow(1.0 - abs(relViewZ), 2.1);
    float rimBoost = rimFresnel * mix(0.14, 0.42, smoothstep(0.18, 0.9, lightFactor));

    // 9. Gentle organic shimmer per particle
    float shimmer = 0.88 + 0.12 * sin(uTime * shimmerSpeed + shimmerPhase);
    shimmer = mix(1.0, shimmer, min(1.0, uAnimationIntensity));

    // 10. Zone-balanced opacity & luminance for AdditiveBlending on pure #000000 black
    float shadowOpacityDrop = mix(0.42, 1.0, smoothstep(0.02, 0.56, lightFactor));
    float shellAlpha = (uLayerRole > 1.5 ? 0.62 : 0.86) * shadowOpacityDrop;
    float interiorAlpha = (uLayerRole < 0.5 ? 0.44 : 0.34) * mix(0.45, 1.0, lightFactor);
    float baseAlpha = mix(interiorAlpha, shellAlpha, step(0.5, zone));

    float waveIntensityBoost = 1.0 + waveGlow * 0.45;
    float finalIntensity = brightnessSeed * depthFactor * shimmer * (1.02 + rimBoost) * uLayerBrightness * waveIntensityBoost;

    vColor = col * clamp(finalIntensity, 0.22, 1.75);
    vAlpha = clamp(
      baseAlpha * uLayerOpacity * brightnessSeed * depthFactor * shimmer * (1.0 + waveGlow * 0.30),
      0.05,
      0.95
    );

    // 11. Strictly uniform particle size across every particle and all three layers
    float basePx = 3.0;
    gl_PointSize = clamp(basePx * uParticleSize * uPixelRatio, 0.5 * uPixelRatio, 12.0 * uPixelRatio);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const orbFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float distSq = dot(centered, centered) * 4.0;
    if (distSq > 1.0) discard;

    // Crisp uniform circular particle disc with tight anti-aliased edge
    float edgeMask = smoothstep(1.0, 0.38, distSq);
    float corePresence = 0.78 + 0.22 * exp(-distSq * 2.6);
    float alpha = edgeMask * corePresence * vAlpha;

    if (alpha < 0.004) discard;

    gl_FragColor = vec4(vColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
