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
  /** small screen-space pixel nudge applied AFTER rotation (so x,y mean screen x,y) */
  nudge?: { x: number; y: number };
};

/* cache: opaque-bbox center offsets (normalized) */
const contentCenterCache = new Map<string, { ox: number; oy: number }>();

const ROT: Record<Heading, number> = { N: 0, E: 90, S: 180, W: 270 };

const ShipTopView: React.FC<Props> = ({ src, rect, heading, opacity = 1, scale = 1, nudge }) => {
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

  // OFFSETS: image-space, pre-rotation (already scaled)
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
        // IMPORTANT: nudge is applied after rotate so it's in screen coords
        transform: `translate(-50%,-50%) ${nudge ? `translate(${nudge.x}px, ${nudge.y}px) ` : ""}rotate(${ROT[heading]}deg) translate(${dx}px, ${dy}px) scale(${scale})`,
        transformOrigin: "center center",
        pointerEvents: "none",
        opacity,
        imageRendering: "auto",
      }}
    />
  );
};

export default ShipTopView;
