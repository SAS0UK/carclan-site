// La scène du site : un parking la nuit, sous des lampadaires au sodium.
//
// Sodium, la direction artistique de CarClan, porte le nom de cette lumière :
// l'ambre de la marque (#e2a21f) est celui d'un lampadaire de parking. La
// scène le prend au mot. Aucun modèle de voiture : les kits low-poly ont été
// retirés le 21 septembre 2026, et aucune vraie voiture n'existe en licence
// commerciale sûre. Ce qui rend l'image, c'est la lumière, pas les objets.
//
// ─── Ce qui fait qu'une image de nuit passe pour une photographie ───────────
//
// Une première version « belle mais fausse » a été mesurée le 21 septembre
// 2026, et quatre défauts de fond en sortaient. Ils guident tout ce fichier :
//
// 1. IL N'Y AVAIT AUCUNE SOURCE. Tout tenait entre 0 et 1 en linéaire, donc
//    rien ne saturait : le rapport de luminance entre la lampe et le sol
//    éclairé était de 2,3:1, quand il est de l'ordre du million dehors. Le
//    tone mapping ACES n'avait rien à comprimer et le bloom rien à étaler.
//    Les lampes dépassent maintenant franchement 1,0 : le cœur devient blanc
//    et la couleur vit dans le halo, comme sur un capteur.
// 2. LE SOL ÉTAIT ADDITIF. `couleur + lumière` au lieu de `albédo ×
//    éclairement` : il n'existait pas d'albédo, donc la matière ne pouvait
//    pas être révélée par la lampe, et aucune peinture blanche n'était
//    possible (elle aurait brillé autant dans le noir que sous la lampe).
// 3. IL N'Y AVAIT AUCUNE RÈGLE GRADUÉE. Un bitume sans marquage n'est pas un
//    parking, c'est une surface : l'œil n'a aucune longueur connue pour juger
//    l'échelle. Les places de 2,50 m sont ce qui manquait le plus.
// 4. IL N'Y AVAIT PAS D'HORIZON. Le sol lointain, la brume et le ciel avaient
//    exactement la même couleur. Dehors, l'air entre l'œil et le fond est
//    lui-même éclairé par les lampes : le lointain est plus clair et plus
//    chaud, et c'est cette bande qui donne la profondeur.
//
// Trois régimes : plein (ordinateur), `lite` (téléphone ou machine faible :
// pas de reflet, pas de profondeur de champ, moins de poussière) et
// `reduced` (prefers-reduced-motion : une seule image, rien ne bouge).
// La scène ne bloque jamais la page : elle se charge après le contenu et
// apparaît en fondu quand sa première image est prête.

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import {
  EffectComposer, RenderPass, EffectPass, Effect,
  BloomEffect, DepthOfFieldEffect, VignetteEffect, NoiseEffect,
  ToneMappingEffect, ToneMappingMode, BlendFunction,
} from 'postprocessing';

const NUIT = 0x0f0e0c;
const AMBRE = 0xe2a21f;
// La lampe elle-même : plus claire que l'encre ambre, c'est une source.
const SODIUM = 0xffc25a;
// La couche de brume, à distance : de la lumière de lampe diffusée par l'air,
// donc plus claire et plus chaude que la nuit. C'est elle qui fait l'horizon.
const BRUME = 0x140f08;

// Les lampadaires : deux rangées qui s'enfoncent dans la brume.
const LAMP_X = 3.4;
const LAMP_H = 4.4;
const LAMP_STEP = 7.5;
const LAMP_ROWS = 7;
const LAMP_COUNT = LAMP_ROWS * 2;
// La hauteur réelle du feu, celle qui sert au calcul de l'éclairement.
const FEU_H = LAMP_H - 0.3;

const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }

  vec2 hash22(vec2 p) {
    vec3 a = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    a += dot(a, a.yzx + 19.19);
    return fract(vec2((a.x + a.y) * a.z, (a.x + a.z) * a.y));
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int k = 0; k < 4; k++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return v;
  }

  // Bruit cellulaire. F1 est nul au cœur d'un gravillon, F2 - F1 est petit
  // sur le joint entre deux gravillons : c'est le liant. Un bruit de valeur
  // donnait un champ flou qui ressemble à du brouillard ; un enrobé est fait
  // de cailloux, et c'est cette structure que l'œil reconnaît comme matière.
  vec2 worley(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float d1 = 8.0, d2 = 8.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        float d = length(g + hash22(i + g) - f);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
    }
    return vec2(d1, d2);
  }
`;

// Le sol. Un seul shader pour les deux régimes : avec REFLECT, il projette la
// texture rendue par le Reflector ; sans, il garde le bitume, son marquage et
// son éclairement. Les lampes n'éclairent pas ce matériau par le moteur (un
// ShaderMaterial n'entre pas dans la chaîne d'éclairage, et c'est aussi
// pourquoi une shadow map ne l'atteindrait pas) : tout est calculé ici, ce
// qui rend les deux régimes identiques et coûte beaucoup moins cher.
function groundShader({ reflect }) {
  return {
    name: 'BitumeMouille',
    defines: reflect ? { REFLECT: '' } : {},
    uniforms: {
      // ⚠️ Reflector.js écrit dans `color` sans condition : cet uniform doit
      // exister, sous ce nom, ou le Reflector plante au premier rendu.
      color: { value: new THREE.Color(NUIT) },
      tDiffuse: { value: null },
      textureMatrix: { value: new THREE.Matrix4() },
      uTime: { value: 0 },
      uLampColor: { value: new THREE.Color(AMBRE) },
      // Par lampe : (x monde, z monde, hauteur du feu, intensité).
      uLamps: { value: Array.from({ length: LAMP_COUNT }, () => new THREE.Vector4()) },
      // Le pied de chaque mât, pour son ombre portée.
      uPoles: { value: Array.from({ length: LAMP_COUNT }, () => new THREE.Vector2()) },
      uHaze: { value: new THREE.Color(BRUME) },
      uFog: { value: 0.03 },
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vUvP;
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vUvP = textureMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform vec3 uLampColor;
      uniform vec4 uLamps[${LAMP_COUNT}];
      uniform vec2 uPoles[${LAMP_COUNT}];
      uniform vec3 uHaze;
      uniform float uFog;
      varying vec4 vUvP;
      varying vec3 vWorld;
      ${NOISE_GLSL}

      // Le relief du bitume, en mètres. Il ne sert qu'à la normale, jamais à
      // la couleur : c'est l'inclinaison de chaque gravillon qui décide de ce
      // que la lampe lui renvoie, et ce sont ces micro-ombres qui tournent
      // quand on avance dans l'allée. Chaque bande porte son niveau de détail,
      // sinon la normale crépite quand la période passe sous le pixel, même
      // si la couleur, elle, ne crépite plus. C'est le point le plus souvent
      // oublié.
      float relief(vec2 p, float a, float b, float c) {
        return vnoise(p * 1.6) * 0.020 * a
             + vnoise(p * 14.0) * 0.006 * b
             + vnoise(p * 42.0) * 0.0022 * c;
      }

      void main() {
        vec2 w = vWorld.xz;
        // La taille d'un pixel projetée au sol : la seule mesure qui permette
        // d'éteindre une fréquence avant qu'elle ne moire.
        float fw = max(fwidth(w.x), fwidth(w.y));

        // Chaque bande s'éteint VERS SA MOYENNE, pas vers zéro : vers zéro,
        // le lointain s'assombrirait au lieu de perdre seulement son contraste.
        float lodA = 1.0 - smoothstep(0.045, 0.16, fw);   // l'ondulation, ~10 cm
        float lodB = 1.0 - smoothstep(0.009, 0.034, fw);  // le gravillon, ~1,2 cm
        float lodC = 1.0 - smoothstep(0.003, 0.011, fw);  // le sable, ~4 mm

        // Les zones mouillées : de grandes nappes qui suivent les creux.
        float wet = smoothstep(0.42, 0.66, fbm(w * 0.09 + 5.3));

        // Le grain, trois bandes filtrées.
        float grain = 0.5 + (vnoise(w * 9.0) - 0.5) * 0.55 * lodA;
        if (lodB > 0.004) {
          vec2 W = worley(w * 82.0);
          float pierre = 1.0 - smoothstep(0.12, 0.60, W.x);
          float joint  = 1.0 - smoothstep(0.020, 0.115, W.y - W.x);
          float agg = clamp(0.34 + 0.66 * pierre - 0.45 * joint, 0.0, 1.0);
          grain += (agg - 0.5) * 0.62 * lodB;
        }
        if (lodC > 0.004) grain += (vnoise(w * 240.0) - 0.5) * 0.30 * lodC;
        grain = clamp(grain, 0.0, 1.0);

        // ---- L'albédo ------------------------------------------------------
        // Un enrobé sec renvoie 5 à 7 % de ce qu'il reçoit. Mouillé, il chute
        // de moitié : l'eau comble les creux et renvoie en miroir au lieu de
        // diffuser. C'est pour cela qu'une chaussée mouillée est plus SOMBRE
        // vue de face et plus brillante vue de loin.
        vec3 albedo = vec3(0.062, 0.058, 0.052) * (0.62 + 0.76 * grain);
        albedo *= mix(1.0, 0.40, wet);

        // ---- Le marquage ---------------------------------------------------
        // La règle graduée de l'image. Des places de 2,50 m de large, de part
        // et d'autre de l'allée, avec leur ligne de fond à 8 m. C'est leur
        // répétition et leur fuite en perspective qui disent à l'œil
        // « parking », et leur largeur connue qui donne l'échelle de tout le
        // reste. Rien dans l'allée : on y circule.
        float bx = abs(w.x);
        float marque = 0.0;
        if (bx > 2.96 && bx < 8.10) {
          float dl = abs(fract(w.y / 2.5 + 0.5) - 0.5) * 2.5;
          marque = 1.0 - smoothstep(0.042, 0.054 + fw * 1.5, dl);
        }
        marque = max(marque, 1.0 - smoothstep(0.045, 0.057 + fw * 1.5, abs(bx - 8.05)));
        // La peinture est usée : l'enrobé la mange par plaques. Et elle
        // s'éteint sous le pixel comme le reste, sinon une ligne de 8 cm à
        // 30 m fait un tiers de pixel et clignote à chaque image.
        marque *= smoothstep(0.30, 0.64, fbm(w * 0.55 + 11.7));
        marque *= 1.0 - smoothstep(0.035, 0.13, fw);
        // Albédo d'une peinture routière : 0,52 contre 0,06 pour l'enrobé.
        // Un peu chaude, jamais du blanc pur.
        albedo = mix(albedo, vec3(0.52, 0.505, 0.470) * (0.80 + 0.20 * grain), marque);

        // ---- La normale ----------------------------------------------------
        float amp = mix(1.0, 0.25, wet);   // l'eau comble le relief
        float pas = max(fw, 0.008);        // jamais sous le pixel
        float hc = relief(w, lodA, lodB, lodC);
        float hx = relief(w + vec2(pas, 0.0), lodA, lodB, lodC);
        float hz = relief(w + vec2(0.0, pas), lodA, lodB, lodC);
        vec3 N = normalize(vec3((hc - hx) * amp / pas, 1.0, (hc - hz) * amp / pas));

        vec3 V = normalize(cameraPosition - vWorld);

        // ---- L'éclairement --------------------------------------------------
        // La somme des lampes, en 1/r² et par le cosinus d'incidence. C'est ce
        // qui fait que les flaques de lumière se chevauchent en un feston
        // continu le long de l'allée, au lieu de quatorze disques séparés qui
        // se lisent comme des spots.
        vec3 E = vec3(0.0);
        for (int i = 0; i < ${LAMP_COUNT}; i++) {
          vec4 L = uLamps[i];
          vec3 Ld = vec3(L.x, L.z, L.y) - vWorld;
          float r2 = dot(Ld, Ld);
          // Coupe douce au loin : sans elle, la queue des quatorze lampes
          // s'additionne en un fond gris qui tue la nuit.
          float portee = 1.0 - smoothstep(0.55, 1.0, r2 / 900.0);
          if (portee <= 0.0) continue;
          vec3 Ln = Ld * inversesqrt(r2);
          float ndl = max(dot(N, Ln), 0.0);

          // L'ombre du mât, calculée à la main : le sol est un ShaderMaterial,
          // il ne reçoit aucune shadow map du moteur. On cherche à quelle
          // distance le rayon qui va du sol vers la lampe passe de l'axe du
          // mât. La pénombre s'élargit à mesure que l'occulteur se rapproche
          // de la source : c'est ce qui donne à l'ombre d'un lampadaire son
          // bord net au pied et flou au bout. Jamais tout à fait noire, la
          // brume rediffuse dedans.
          vec2 seg = L.xy - w;
          vec2 rel = uPoles[i] - w;
          float t = clamp(dot(rel, seg) / max(dot(seg, seg), 1e-4), 0.0, 1.0);
          float ecart = length(rel - seg * t);
          float penombre = 0.03 + 0.25 * t / max(1.0 - t, 0.2);
          float ombre = mix(0.16, 1.0, smoothstep(0.055, 0.055 + penombre, ecart));

          E += uLampColor * ndl * (L.w / (r2 + 1.0)) * portee * ombre;
        }
        // Le ciel de ville : minuscule, et ouvert vers le haut.
        E += vec3(0.011, 0.0095, 0.0080) * (0.45 + 0.55 * N.y);

        vec3 col = albedo * E;

        // ---- Le reflet -------------------------------------------------------
        #ifdef REFLECT
          // Fresnel de Schlick, exposant 5. C'est lui qui fait la différence
          // entre un sol presque noir à vos pieds et un miroir à l'horizon.
          // L'ancien exposant 2,5, borné entre 0,41 et 0,90, donnait un vernis
          // brillant partout pareil, ce qui se lit comme du plastique.
          float cosT = clamp(dot(N, V), 0.0, 1.0);
          float F0 = mix(0.040, 0.020, wet);
          float F = F0 + (1.0 - F0) * pow(1.0 - cosT, 5.0);
          // Un enrobé sec est trop rugueux pour renvoyer une image : il n'en
          // garde qu'un voile. L'eau garde tout.
          float porteeRefl = mix(0.10, 1.0, wet);

          // Les rides viennent de la normale du sol, pas d'un bruit décorrélé :
          // c'est le relief lui-même qui casse le reflet, donc le sec le
          // détruit et la flaque le garde.
          vec2 base = vUvP.xy / max(vUvP.w, 1e-4);
          base += N.xz * mix(0.085, 0.009, wet);

          // Sept prélèvements sur le SEUL axe vertical : un reflet sur une
          // surface horizontale micro-rugueuse s'étire verticalement, il ne
          // s'étale pas en rond. C'est la traînée de lampe sur chaussée
          // mouillée. Le pas est quadratique, donc dense près du point de
          // contact et étalé au loin ; le jitter casse les sept bandes.
          float rough = mix(0.155, 0.018, wet);
          float span = rough * (0.25 + 0.75 * (1.0 - cosT));
          vec3 refl = vec3(0.0);
          float wsum = 0.0;
          for (int t2 = 0; t2 < 7; t2++) {
            float f = float(t2) / 6.0;
            float off = f * f * span;
            float jit = (hash21(w * 130.0 + float(t2)) - 0.5) * span * 0.11;
            float wgt = exp(-2.6 * f * f);
            refl += texture2D(tDiffuse, base + vec2(jit, off)).rgb * wgt;
            wsum += wgt;
          }
          col += (refl / wsum) * F * porteeRefl;
        #endif

        // ---- La brume ---------------------------------------------------------
        // Elle n'est pas de la couleur du ciel : elle est éclairée par les
        // lampes qu'elle avale, donc plus claire et plus chaude avec la
        // distance. C'est ce qui fabrique un horizon là où il n'y en avait pas.
        float dist = distance(cameraPosition, vWorld);
        float fog = 1.0 - exp(-uFog * uFog * dist * dist);
        vec3 haze = mix(color, uHaze, smoothstep(6.0, 55.0, dist));
        col = mix(col, haze, fog);

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  };
}

// Le cône de lumière sous une lampe : un cylindre ouvert, additif, dont
// l'intensité tombe en 1/r² depuis la source et vers les bords, traversé de
// volutes. L'ancien profil `pow(t, 1.6)` restait à 33 % à mi-hauteur là où la
// vraie loi donne 2 % : presque uniforme sur toute la longueur, ce qui
// produisait des triangles réglés. Un vrai faisceau est violemment brillant
// juste sous le luminaire et s'éteint vite.
function coneMaterial(seed) {
  return new THREE.ShaderMaterial({
    name: 'ConeDeLumiere',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(AMBRE) },
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uSeed: { value: seed },
      uFog: { value: 0.03 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uIntensity;
      uniform float uSeed;
      uniform float uFog;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vWorld;
      ${NOISE_GLSL}
      void main() {
        // vUv.y vaut 1 sous la lampe et 0 au sol : la distance à la source
        // est donc (1 - vUv.y), et l'intensité tombe en son carré.
        float d = 1.0 - vUv.y;
        float vert = 1.0 / (1.0 + 26.0 * d * d);
        vec3 V = normalize(cameraPosition - vWorld);
        float edge = smoothstep(0.0, 0.85, abs(dot(normalize(vN), V)));
        float n = vnoise(vec2(vUv.x * 5.0 + uSeed, vUv.y * 2.6 - uTime * 0.22)) * 0.5 + 0.5;
        float dist = distance(cameraPosition, vWorld);
        float fog = exp(-uFog * uFog * dist * dist);
        float a = vert * edge * (0.55 + 0.45 * n) * uIntensity * fog * 1.1;
        gl_FragColor = vec4(uColor * a, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

// La poussière : des grains qui tombent lentement dans les faisceaux, plus
// gros et plus clairs près de la caméra, éteints par la brume au loin.
function dustMaterial(pixelRatio) {
  return new THREE.ShaderMaterial({
    name: 'Poussiere',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(SODIUM) },
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uFog: { value: 0.03 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uFog;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * (0.05 + 0.05 * aSeed), ${LAMP_H.toFixed(1)});
        p.x += sin(uTime * 0.25 + aSeed * 6.2831) * 0.12;
        p.z += cos(uTime * 0.21 + aSeed * 6.2831) * 0.12;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        gl_PointSize = (0.7 + aSeed * 0.8) * uPixelRatio * clamp(60.0 / d, 0.3, 4.0);
        // La poussière n'est visible que dans la lumière : forte sous la
        // lampe (p.y haut), faible au sol.
        vA = exp(-uFog * uFog * d * d) * mix(0.25, 1.0, p.y / ${LAMP_H.toFixed(1)});
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, r) * vA * 0.12;
        gl_FragColor = vec4(uColor * a, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

// Le halo d'une lampe vue de face, toujours face à la caméra. Profil resserré :
// l'ancien (0,18 à 0,75) était un aplat qui débordait de la tête et se lisait
// comme un disque collé derrière chaque boîtier.
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.08, 'rgba(255,255,255,0.55)');
  r.addColorStop(0.22, 'rgba(255,255,255,0.12)');
  r.addColorStop(0.55, 'rgba(255,255,255,0.02)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createScene(canvas, { lite = false, reduced = false, touch = false } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  // Le tone mapping est fait en fin de chaîne par le composer, en HDR ; le
  // moteur, lui, rend en linéaire. ⚠️ `toneMapped: false` sur un matériau n'a
  // donc aucun effet ici ; si le tone mapping du moteur était activé un jour,
  // les sources seraient traitées deux fois.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(NUIT, 1);

  const scene = new THREE.Scene();
  // Le ciel reste la nuit de la palette ; seule la couche de brume se
  // réchauffe. C'est l'écart entre les deux qui dessine l'horizon, et c'est
  // aussi ce qui évite que les mâts lointains restent noirs sur fond ambre.
  scene.background = new THREE.Color(NUIT);
  const fogDensity = lite ? 0.034 : 0.03;
  scene.fog = new THREE.FogExp2(BRUME, fogDensity);

  // near à 0,5 et non 0,1 : le matériau du cercle de confusion lit le tampon
  // de profondeur, et cinq fois plus de précision utile lui évite des paliers
  // visibles dans le flou. Rien n'est coupé, le sol le plus proche est à plus
  // d'un mètre.
  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.5, 140);
  camera.position.set(0.7, 1.55, 4);
  const look = new THREE.Vector3(0, 1.3, -14);

  // ---- Les lampes ---------------------------------------------------------
  const lampPositions = [];
  for (let i = 0; i < LAMP_ROWS; i++) {
    const z = -2 - i * LAMP_STEP;
    lampPositions.push(new THREE.Vector3(-LAMP_X, LAMP_H, z), new THREE.Vector3(LAMP_X, LAMP_H, z));
  }
  const headX = (p) => p.x + (p.x < 0 ? 1 : -1) * 0.85;

  // Un mât de parking est du métal peint ou galvanisé, pas un absorbant noir.
  // L'ancien réglage (albédo 0,7 % à metalness 0,5) donnait un F0 de 0,0235,
  // sous le plancher diélectrique de 0,04 : une matière qui n'existe pas, et
  // des barres parfaitement plates à l'écran, identiques de près comme de
  // loin. En vrai métal, la lampe allume sur le fût la longue traînée
  // spéculaire verticale qui est le signe le plus reconnaissable d'un
  // lampadaire de nuit.
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x8e897f, roughness: 0.42, metalness: 1.0 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xaba69c, roughness: 0.30, metalness: 1.0 });

  // La lampe est une SOURCE : elle doit creuser le blanc, pas l'effleurer.
  // Au-delà de 1,0 en linéaire, l'ACES sature les trois canaux au cœur et
  // laisse l'ambre sur la jupe, ce que fait un capteur devant un sodium.
  const bulbMat = new THREE.MeshBasicMaterial({ color: SODIUM, toneMapped: false });
  bulbMat.color.multiplyScalar(8.5);

  const mastGeo = new THREE.CylinderGeometry(0.045, 0.075, LAMP_H, 10);
  const armGeo = new THREE.BoxGeometry(0.9, 0.06, 0.06);
  const headGeo = new THREE.BoxGeometry(0.62, 0.12, 0.3);
  const bulbGeo = new THREE.PlaneGeometry(0.46, 0.16);
  const coneGeo = new THREE.CylinderGeometry(0.22, 2.35, LAMP_H - 0.2, 40, 1, true);
  const glowMap = glowTexture();
  const cones = [];

  lampPositions.forEach((p, i) => {
    const side = p.x < 0 ? 1 : -1; // la tête se penche vers la voie
    const hx = headX(p);

    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(p.x, LAMP_H / 2, p.z);
    scene.add(mast);

    const arm = new THREE.Mesh(armGeo, mastMat);
    arm.position.set(p.x + side * 0.42, LAMP_H - 0.06, p.z);
    scene.add(arm);

    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(hx, LAMP_H - 0.1, p.z);
    scene.add(head);

    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.rotation.x = -Math.PI / 2;
    bulb.position.set(hx, LAMP_H - 0.165, p.z);
    scene.add(bulb);

    const glowMat = new THREE.SpriteMaterial({
      map: glowMap, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
    });
    glowMat.color.setHex(SODIUM).multiplyScalar(2.2);
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(0.82, 0.82, 1);
    glow.position.set(hx, LAMP_H - 0.2, p.z);
    scene.add(glow);

    const cone = new THREE.Mesh(coneGeo, coneMaterial(i * 1.37));
    cone.position.set(hx, (LAMP_H - 0.2) / 2, p.z);
    cones.push(cone);
    scene.add(cone);

    // Les vraies lumières ne servent qu'aux mâts et aux têtes, le sol calcule
    // le sien. 260 cd, très en dessous des 3 000 à 5 000 cd du pic d'un vrai
    // luminaire : une PointLight rayonne dans toutes les directions, là où un
    // luminaire de parking est occulté vers le haut et vers l'arrière.
    if (i < 6) {
      const light = new THREE.PointLight(SODIUM, 260, 26, 2);
      light.position.set(hx, FEU_H, p.z);
      scene.add(light);
    }
  });

  // ---- Le sol ---------------------------------------------------------------
  const groundGeo = new THREE.PlaneGeometry(160, 160);
  const reflSize = () => [
    Math.round(window.innerWidth * Math.min(dpr, 1.5) * 0.5),
    Math.round(window.innerHeight * Math.min(dpr, 1.5) * 0.5),
  ];
  let ground;
  let groundUniforms;
  if (lite) {
    const mat = new THREE.ShaderMaterial(groundShader({ reflect: false }));
    ground = new THREE.Mesh(groundGeo, mat);
    groundUniforms = mat.uniforms;
  } else {
    const [rw, rh] = reflSize();
    ground = new Reflector(groundGeo, { clipBias: 0.004, textureWidth: rw, textureHeight: rh, color: NUIT, shader: groundShader({ reflect: true }) });
    groundUniforms = ground.material.uniforms;
  }
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  lampPositions.forEach((p, i) => {
    // (x, z, hauteur du feu, intensité). 10,5 est calibré pour que le sol
    // sous une lampe garde son niveau : 10,5 / (4,1² + 1) × albédo.
    groundUniforms.uLamps.value[i].set(headX(p), p.z, FEU_H, 10.5);
    groundUniforms.uPoles.value[i].set(p.x, p.z);
  });
  groundUniforms.uFog.value = fogDensity;

  // ---- La poussière ----------------------------------------------------------
  const dustCount = lite ? 500 : 1600;
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    const L = lampPositions[i % lampPositions.length];
    const hx = headX(L);
    const y = Math.random() * LAMP_H;
    const r = (0.1 + (1 - y / LAMP_H) * 1.5) * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    dustPos[i * 3] = hx + Math.cos(a) * r;
    dustPos[i * 3 + 1] = y;
    dustPos[i * 3 + 2] = L.z + Math.sin(a) * r;
    dustSeed[i] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1));
  const dust = new THREE.Points(dustGeo, dustMaterial(dpr));
  dust.frustumCulled = false;
  scene.add(dust);
  dust.material.uniforms.uFog.value = fogDensity;
  cones.forEach((c) => { c.material.uniforms.uFog.value = fogDensity; });

  // ---- La chaîne d'effets ------------------------------------------------------
  // ⚠️ Pas de multisampling sur ce composer : combiné au tampon demi-flottant
  // qu'exige le HDR, il rend une image entièrement noire sur les pilotes qui
  // ne savent pas résoudre un tampon multi-échantillons de ce format (vérifié
  // le 21 septembre 2026, Chrome headless). L'aliasing est de toute façon peu
  // visible ici : la brume, le bloom et le grain adoucissent les arêtes.
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
  composer.addPass(new RenderPass(scene, camera));

  // ⚠️ ADD et non SCREEN. Le GLSL de SCREEN est `dst + src - min(dst*src, 1)` :
  // dès que dst dépasse 1,0, c'est-à-dire précisément au cœur des lampes, le
  // résultat devient inférieur à dst. Le bloom RETIRAIT de la lumière à ce
  // qu'il devait faire exploser. Le seuil monte à 1,0 pour que seules les
  // vraies sources passent : à 0,42 il attrapait aussi les flaques au sol, et
  // le halo cessait d'être accroché à une source pour devenir une brume.
  const bloom = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: lite ? 0.30 : 0.38,
    luminanceThreshold: 1.0,
    luminanceSmoothing: 0.45,
    mipmapBlur: true,
    radius: 0.72,
    levels: lite ? 5 : 7,
  });

  // Le plancher de la nuit. Dehors, le noir absolu n'existe pas : il y a
  // toujours le ciel, et le ciel est froid. C'est cet écart de température
  // entre des ombres bleutées et des lampes chaudes, plus que l'ambre seul,
  // qui fait lire une image comme une photographie de nuit. La mesure sur la
  // version précédente donnait 48 % des pixels sous 16/255 et un coin à
  // rgb(0,0,0) parfaitement propre : aucun capteur ne produit cela.
  const plancher = new Effect('PlancherDeNuit', /* glsl */`
    uniform vec3 uLift;
    uniform float uFall;
    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
      float l = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      float k = exp(-l / uFall);
      outputColor = vec4(inputColor.rgb + uLift * k, inputColor.a);
    }`, {
    blendFunction: BlendFunction.SRC,
    uniforms: new Map([
      ['uLift', new THREE.Uniform(new THREE.Vector3(0.0034, 0.0042, 0.0068))],
      ['uFall', new THREE.Uniform(0.018)],
    ]),
  });

  // Le vignettage était une falaise : plat jusqu'à 0,25 du rayon puis 1,75
  // diaphragme perdu sur 30 %, ce qui dessinait un anneau. Un objectif roule
  // doucement, il ne fait pas de marche.
  const vignette = new VignetteEffect({ offset: 0.35, darkness: 0.42 });
  // ⚠️ `premultiply` rend le grain MULTIPLICATIF : il était donc proportionnel
  // au signal, présent dans les hautes lumières et strictement nul dans les
  // noirs, soit l'exact inverse d'un capteur en haute sensibilité.
  const noise = new NoiseEffect({ premultiply: false, blendFunction: BlendFunction.SCREEN });
  noise.blendMode.opacity.value = 0.022;
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });

  // Le point de netteté est fixe DANS LE MONDE, pas devant la caméra : en
  // avançant dans l'allée, une paire de lampadaires arrive au net puis repart
  // dans le flou. Une caméra qui garde tout net à la même distance d'elle-même
  // n'est pas une caméra.
  const netPoint = new THREE.Vector3(0, 1.2, -20.5);
  let dof = null;
  const effects = [bloom];
  if (!lite) {
    // ⚠️ `focalLength` est déprécié dans postprocessing 6.39 et est réaffecté
    // à `focusRange`, EN UNITÉS MONDE. L'ancienne valeur de 0,05 mettait donc
    // tout ce qui dépassait cinq centimètres du plan net au flou maximal, pour
    // un rayon de 2,2 pixels : un flou uniforme et invisible, au prix de sept
    // passes. 6,5 m correspond à la profondeur de champ d'un 35 mm à f/1,8.
    dof = new DepthOfFieldEffect(camera, {
      focusDistance: 9.0,
      focusRange: 6.5,
      bokehScale: 3.4,
      resolutionScale: 0.5,
    });
    effects.push(dof);
  }
  effects.push(plancher, vignette, noise, tone);
  composer.addPass(new EffectPass(camera, ...effects));

  // ---- Le mouvement --------------------------------------------------------------
  const pointer = new THREE.Vector2(0, 0);
  const pointerEased = new THREE.Vector2(0, 0);
  let progress = 0;
  let progressEased = 0;
  let time = 0;
  let running = false;
  let raf = 0;
  let ready = false;
  // Le pas de temps est mesuré ici plutôt qu'avec THREE.Clock, déprécié depuis
  // r180 et sans remplaçant dans cette version. Le delta est borné : au retour
  // d'un onglet resté caché, un pas énorme ferait sauter la caméra.
  let dernier = 0;

  function place() {
    const p = progressEased;
    camera.position.x = 0.7 + pointerEased.x * 0.55 - p * 0.4;
    camera.position.y = 1.55 + pointerEased.y * 0.18 + p * 0.85;
    camera.position.z = 4 - p * 26;
    look.set(0.1 - pointerEased.x * 0.6, 1.3 + p * 1.4 + pointerEased.y * 0.35, camera.position.z - 16);
    camera.lookAt(look);
    if (dof) dof.cocMaterial.focusDistance = camera.position.distanceTo(netPoint);
  }

  function frame() {
    const maintenant = performance.now() / 1000;
    const dt = dernier ? Math.min(maintenant - dernier, 0.05) : 0.016;
    dernier = maintenant;
    time += dt;
    const k = 1 - Math.pow(0.001, dt); // lissage indépendant de la cadence
    pointerEased.lerp(pointer, k * 0.6);
    progressEased += (progress - progressEased) * k * 0.9;
    place();
    groundUniforms.uTime.value = time;
    dust.material.uniforms.uTime.value = time;
    for (let i = 0; i < cones.length; i++) {
      const m = cones[i].material.uniforms;
      m.uTime.value = time;
      // Un scintillement à peine perceptible, propre à chaque lampe : rien
      // dehors n'est parfaitement régulier.
      m.uIntensity.value = 0.94 + 0.06 * Math.sin(time * (1.7 + i * 0.13) + i);
    }
    composer.render(dt);
    if (!ready) { ready = true; canvas.classList.add('on'); }
  }

  function loop() {
    if (!running) return;
    frame();
    raf = requestAnimationFrame(loop);
  }

  // `compileAsync` prépare les programmes GPU sans bloquer : sans lui, la
  // première image compile une douzaine de shaders d'un coup et gèle la page.
  const pret = renderer.compileAsync
    ? renderer.compileAsync(scene, camera).catch(() => {})
    : Promise.resolve();

  function start() {
    if (reduced) { pret.then(() => { progressEased = progress; pointerEased.set(0, 0); frame(); }); return; }
    if (running) return;
    running = true;
    dernier = 0;
    pret.then(() => { if (running) raf = requestAnimationFrame(loop); });
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    if (ground.getRenderTarget) ground.getRenderTarget().setSize(...reflSize());
    if (reduced) frame();
  }

  // Sur ordinateur, la caméra suit un peu le curseur. Au doigt, rien : un
  // téléphone qui bouge la caméra à chaque tap est pénible.
  if (!touch && !reduced) {
    window.addEventListener('pointermove', (e) => {
      pointer.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    }, { passive: true });
  }

  // La scène ne tourne pas quand l'onglet est caché.
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });

  return {
    lite,
    start,
    stop,
    resize,
    setProgress(p) { progress = Math.max(0, Math.min(1, p)); if (reduced) { progressEased = progress; frame(); } },
    // Si la cadence ne tient pas, on baisse la définition et on retire la
    // profondeur de champ, sans recréer la scène.
    degrade() {
      renderer.setPixelRatio(1);
      composer.setSize(window.innerWidth, window.innerHeight);
      if (dof) {
        composer.removeAllPasses();
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new EffectPass(camera, bloom, plancher, vignette, noise, tone));
        dof = null;
      }
    },
  };
}
