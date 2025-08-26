// src/components/games/battleship/dev/ShipTopView.tsx
import React from "react";

export type Heading = "N" | "E" | "S" | "W";
type Rect = { x: number; y: number; w: number; h: number };

type Props = {
  src: string;
  rect: Rect;
  heading: Heading;
  opacity?: number;
  /** compensates for transparent padding in the PNG (1.0 = no extra scale) */
  scale?: number;
};

/* cache: opaque-bbox center offsets (normalized) */
const contentCenterCache = new Map<string, { ox: number; oy: number }>();

const ROT: Record<Heading, number> = { N: 0, E: 90, S: 180, W: 270 };

const ShipTopView: React.FC<Props> = ({ src, rect, heading, opacity = 1, scale = 1 }) => {
  const [alphaOff, setAlphaOff] = React.useState<{ ox: number; oy: number }>({ ox: 0, oy: 0 });
  const [imgSize, setImgSize] = React.useState<{ w: number; h: number }>({ w: 1, h: 1 });

  // Measure opaque bbox center once per image
  React.useEffect(() => {
    let alive = true;
    if (contentCenterCache.has(src)) {
      setAlphaOff(contentCenterCache.get(src)!);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth || 1, h = img.naturalHeight || 1;
        setImgSize({ w, h });
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, w, h);
        let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const a = data[(y * w + x) * 4 + 3];
          if (a > 8) { found = true;
            if (x < minX) minX = x; if (y < minY) minY = y;
            if (x > maxX) maxX = x; if (y > maxY) maxY = y;
          }
        }
        let ox = 0, oy = 0;
        if (found) {
          const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
          ox = (cx - w / 2) / w;    // [-0.5..0.5]
          oy = (cy - h / 2) / h;
        }
        const off = { ox, oy };
        contentCenterCache.set(src, off);
        if (alive) setAlphaOff(off);
      } catch {}
    };
    img.src = src;
    return () => { alive = false; };
  }, [src]);

  // Compute final drawn content size with object-fit: contain, then scale
  const ar = imgSize.w / imgSize.h;
  const rectAR = rect.w / rect.h || 1;
  let finalW = rect.w * scale;
  let finalH = rect.h * scale;
  if (isFinite(ar) && ar > 0) {
    if (ar >= rectAR) {
      finalW = rect.w * scale;
      finalH = (rect.w / ar) * scale;
    } else {
      finalH = rect.h * scale;
      finalW = (rect.h * ar) * scale;
    }
  }

  // OFFSETS: image-space, pre-rotation
  const dx = -alphaOff.ox * finalW;
  const dy = -alphaOff.oy * finalH;

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      aria-hidden="true"
      style={{
        position: "absolute",
        left: rect.x + rect.w / 2,
        top:  rect.y + rect.h / 2,
        width: rect.w,
        height: rect.h,
        objectFit: "contain",
        transform: `translate(-50%,-50%) rotate(${ROT[heading]}deg) translate(${dx}px, ${dy}px) scale(${scale})`,
        transformOrigin: "center center",
        pointerEvents: "none",
        opacity,
        imageRendering: "auto",
        zIndex: 16,  
      }}
    />
  );
};

export default ShipTopView;




// import React from "react";
// import * as THREE from "three";
// import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
// import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

// // Helper: build URLs to your files inside src (works with webpack 5)
// function shipAssetPaths(ship: string) {
//   const base = new URL(`../../../assets/ships/raw/${ship}/`, import.meta.url);
//   const objUrl = new URL(`${ship}.obj`, base).toString();
//   const mtlUrl = new URL(`${ship}.mtl`, base).toString();
//   const texBaseUrl = base.toString(); // textures/ is inside that folder
//   return { objUrl, mtlUrl, texBaseUrl };
// }

// type Props = {
//   ship: "visby" | "k130" | "saar6" | "lcs-independence" | "lcs-freedom";
//   w?: number;
//   h?: number;
//   headingDeg?: 0 | 90 | 180 | 270; // optional top-heading (kept simple)
// };

// export default function ShipTopView({ ship, w = 360, h = 220, headingDeg = 0 }: Props) {
//   const ref = React.useRef<HTMLDivElement>(null);

//   React.useEffect(() => {
//     const mount = ref.current!;
//     const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
//     renderer.setClearColor(0x000000, 0);
//     renderer.outputColorSpace = THREE.SRGBColorSpace;
//     renderer.toneMapping = THREE.ACESFilmicToneMapping;
//     renderer.toneMappingExposure = 1.0;
//     renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
//     renderer.setSize(w, h);
//     mount.appendChild(renderer.domElement);

//     const scene = new THREE.Scene();
//     scene.background = null;

//     // orthographic top-down camera
//     const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
//     cam.up.set(0, 0, -1);
//     cam.position.set(0, 100, 0);
//     cam.lookAt(0, 0, 0);

//     // lights
//     const key = new THREE.DirectionalLight(0xffffff, 1.1);
//     key.position.set(2, 3, 2);
//     scene.add(key);
//     scene.add(new THREE.AmbientLight(0xffffff, 0.6));

//     const { objUrl, mtlUrl, texBaseUrl } = shipAssetPaths(ship);

//     // Load materials then OBJ
//     const mtlLoader = new MTLLoader();
//     // Ensure relative texture paths resolve inside the ship folder
//     mtlLoader.setTexturePath(texBaseUrl);
//     mtlLoader.setResourcePath(texBaseUrl);
//     mtlLoader.setMaterialOptions({ side: THREE.DoubleSide });

//     mtlLoader.load(
//       mtlUrl,
//       (mtl) => {
//         mtl.preload();

//         const objLoader = new OBJLoader();
//         objLoader.setMaterials(mtl);
//         objLoader.load(
//           objUrl,
//           (obj) => {
//             // lay the deck under the top camera
//             obj.rotation.x = -Math.PI / 2;
//             // optional heading (N/E/S/W in degrees)
//             obj.rotateY(THREE.MathUtils.degToRad(headingDeg));

//             // normalize textures & quality
//             const maxAniso = renderer.capabilities.getMaxAnisotropy
//               ? renderer.capabilities.getMaxAnisotropy()
//               : 1;

//             obj.traverse((c: any) => {
//               if (c.isMesh && c.material) {
//                 const m = c.material;
//                 const maps = ["map", "emissiveMap", "aoMap"];
//                 maps.forEach((k) => {
//                   if (m[k]) {
//                     m[k].colorSpace = THREE.SRGBColorSpace; // color maps in sRGB
//                     m[k].anisotropy = maxAniso;
//                     m[k].needsUpdate = true;
//                   }
//                 });
//                 ["metalnessMap", "roughnessMap", "normalMap"].forEach((k) => {
//                   if (m[k]) {
//                     m[k].anisotropy = maxAniso;
//                     m[k].needsUpdate = true;
//                   }
//                 });
//               }
//             });

//             // center at origin
//             const box = new THREE.Box3().setFromObject(obj);
//             const size = new THREE.Vector3();
//             const center = new THREE.Vector3();
//             box.getSize(size);
//             box.getCenter(center);
//             obj.position.sub(center);
//             scene.add(obj);

//             // --- Fit to view with aspect-correct ortho frustum (prevents clipping/stretch) ---
//             const margin = 1.15; // 15% padding around the model
//             const modelW = size.x * margin;
//             const modelH = size.z * margin; // after -X rot, forward is Z

//             const viewAspect = w / h;
//             const modelAspect = modelW / modelH;

//             let halfW: number;
//             let halfH: number;

//             if (viewAspect > modelAspect) {
//               // canvas is wider => height is the limiter; expand width to match aspect
//               halfH = modelH / 2;
//               halfW = halfH * viewAspect;
//             } else {
//               // canvas is taller => width is the limiter; expand height to match aspect
//               halfW = modelW / 2;
//               halfH = halfW / viewAspect;
//             }

//             cam.left = -halfW;
//             cam.right = halfW;
//             cam.top = halfH;
//             cam.bottom = -halfH;
//             cam.updateProjectionMatrix();

//             renderer.render(scene, cam);
//           },
//           undefined,
//           (err) => {
//             console.error("OBJ load error", err);
//           }
//         );
//       },
//       undefined,
//       (err) => {
//         console.error("MTL load error", err);
//       }
//     );

//     return () => {
//       try {
//         // best-effort cleanup
//         scene.traverse((o: any) => {
//           if (o.isMesh) {
//             o.geometry?.dispose?.();
//             const mats = Array.isArray(o.material) ? o.material : [o.material];
//             mats?.forEach((m) => {
//               ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"].forEach((k) => {
//                 if (m && m[k] && m[k].dispose) m[k].dispose();
//               });
//               m?.dispose?.();
//             });
//           }
//         });
//       } catch {}
//       renderer.dispose();
//       mount.removeChild(renderer.domElement);
//     };
//   }, [ship, w, h, headingDeg]);

//   return <div ref={ref} style={{ width: w, height: h }} />;
// }
