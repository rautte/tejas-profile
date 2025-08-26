import React from "react";

/* ---------- module-scoped cache (persists across renders) ---------- */
const BITMAP_CACHE = new Map<string, (ImageBitmap | HTMLImageElement)[]>();
const keyOfFrames = (arr: string[]) => arr.join("|");

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    (img as any).loading = "eager";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
    img.decode?.().then(() => resolve(img)).catch(() => { /* onload resolves */ });
  });
}

async function decodeFrames(frames: string[]): Promise<(ImageBitmap | HTMLImageElement)[]> {
  const loaded = await Promise.all(
    frames.map(async (src, i) => {
      const img = await loadImage(src);
      let bmp: ImageBitmap | null = null;
      if (typeof window !== "undefined" && "createImageBitmap" in window) {
        try { bmp = await (window as any).createImageBitmap(img); } catch {}
      }
      return [i, (bmp || img)] as const;
    })
  );
  loaded.sort((a, b) => a[0] - b[0]);
  return loaded.map(([, im]) => im);
}

type Props = {
  frames: string[];     // ordered PNGs for one full 360°
  fps?: number;         // display rate (time-based)
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Smooth 360° loop that resists UI churn and avoids resize flicker.
 */
const SideSpin: React.FC<Props> = React.memo(({ frames, fps = 36, className, style }) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const imgsRef = React.useRef<(ImageBitmap | HTMLImageElement)[]>([]);
  const fpsRef = React.useRef(fps);
  React.useEffect(() => { fpsRef.current = fps; }, [fps]);

  // track last canvas pixel size to avoid unnecessary clears
  const lastPxSizeRef = React.useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  React.useEffect(() => {
    let cancelled = false;

    const c = canvasRef.current!;
    const ctx = c.getContext("2d", { alpha: true })!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const drawFrameAt = (tMs: number) => {
      const imgs = imgsRef.current;
      if (!imgs || imgs.length === 0) return;

      const N = imgs.length;
      const frame = Math.floor((tMs * fpsRef.current) / 1000) % N;
      const img = imgs[frame]!;
      const iw = (img as any).naturalWidth ?? (img as any).width ?? 1;
      const ih = (img as any).naturalHeight ?? (img as any).height ?? 1;

      const cw = c.width / dpr, ch = c.height / dpr;

      // No full clear needed; copy mode overwrites the pixels in one go.
      const prevOp = ctx.globalCompositeOperation;
      // @ts-ignore - supported widely enough
      ctx.globalCompositeOperation = "copy";

      // contain-fit
      const ir = iw / ih, cr = cw / ch;
      let dw = cw, dh = ch;
      if (ir > cr) { dh = cw / ir; } else { dw = ch * ir; }
      const dx = (cw - dw) / 2, dy = (ch - dh) / 2;

      ctx.drawImage(img as any, dx, dy, dw, dh);
      ctx.globalCompositeOperation = prevOp;
    };

    // debounced resize that redraws immediately (prevents a transparent frame)
    let roRaf: number | null = null;
    const handleResize = () => {
      if (cancelled) return;
      if (roRaf) cancelAnimationFrame(roRaf);
      roRaf = requestAnimationFrame(() => {
        if (cancelled) return;
        const wCss = Math.max(1, c.clientWidth | 0);
        const hCss = Math.max(1, c.clientHeight | 0);
        if (wCss < 2 || hCss < 2) return; // ignore transient 0-size during layout

        const wPx = Math.round(wCss * dpr);
        const hPx = Math.round(hCss * dpr);

        const last = lastPxSizeRef.current;
        if (wPx !== last.w || hPx !== last.h) {
          last.w = wPx; last.h = hPx;
          c.width = wPx;
          c.height = hPx;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.imageSmoothingEnabled = true;
          // @ts-ignore
          if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";

          // redraw *now* so there is no visible transparent frame
          drawFrameAt(performance.now());
        }
      });
    };

    // initial size + observer
    handleResize();
    const ro = new ResizeObserver(handleResize);
    ro.observe(c);

    const drawLoop = (t: number) => {
      if (cancelled) return;
      drawFrameAt(t);
      rafRef.current = requestAnimationFrame(drawLoop);
    };

    const key = keyOfFrames(frames);
    const cached = BITMAP_CACHE.get(key);

    (async () => {
      const decoded = cached ?? await decodeFrames(frames);
      if (cancelled) return;
      if (!cached) BITMAP_CACHE.set(key, decoded);
      imgsRef.current = decoded;

      // start loop once images are ready
      if (!rafRef.current) rafRef.current = requestAnimationFrame(drawLoop);
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (roRaf) cancelAnimationFrame(roRaf);
      ro.disconnect();
    };
  }, [frames]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
        willChange: "transform",
        contain: "paint",
        ...style,
      }}
    />
  );
});

export default SideSpin;



// import React from "react";

// /* ---------- module-scoped cache (persists across renders) ---------- */
// const BITMAP_CACHE = new Map<string, (ImageBitmap | HTMLImageElement)[]>();
// const keyOfFrames = (arr: string[]) => arr.join("|");

// function loadImage(src: string): Promise<HTMLImageElement> {
//   return new Promise((resolve, reject) => {
//     const img = new Image();
//     img.decoding = "async";
//     (img as any).loading = "eager";
//     img.onload = () => resolve(img);
//     img.onerror = reject;
//     img.src = src;
//     // Try decode for faster paint; fall back to onload if it rejects
//     img.decode?.().then(() => resolve(img)).catch(() => { /* onload will resolve */ });
//   });
// }

// async function decodeFrames(frames: string[]): Promise<(ImageBitmap | HTMLImageElement)[]> {
//   // load concurrently, preserve order by index
//   const loaded = await Promise.all(
//     frames.map(async (src, i) => {
//       const img = await loadImage(src);
//       let bmp: ImageBitmap | null = null;
//       if (typeof window !== "undefined" && "createImageBitmap" in window) {
//         try { bmp = await (window as any).createImageBitmap(img); } catch {}
//       }
//       return [i, (bmp || img)] as const;
//     })
//   );
//   loaded.sort((a, b) => a[0] - b[0]);
//   return loaded.map(([, im]) => im);
// }

// type Props = {
//   frames: string[];     // ordered PNGs for one full 360°
//   fps?: number;         // display rate (time-based)
//   className?: string;
//   style?: React.CSSProperties;
// };

// /**
//  * Smooth 360° loop that resists UI churn:
//  * - rAF + absolute time (no local start time → no mid-cycle resets)
//  * - Canvas draw (no <img> churn)
//  * - Full preload before first frame (no partial loops)
//  * - Frame bitmaps cached per module (no re-decode)
//  */
// const SideSpin: React.FC<Props> = React.memo(({ frames, fps = 36, className, style }) => {
//   const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
//   const rafRef = React.useRef<number | null>(null);

//   const imgsRef = React.useRef<(ImageBitmap | HTMLImageElement)[]>([]);
//   const fpsRef = React.useRef(fps);
//   React.useEffect(() => { fpsRef.current = fps; }, [fps]);

//   React.useEffect(() => {
//     let cancelled = false;

//     const c = canvasRef.current!;
//     const ctx = c.getContext("2d", { alpha: true })!;
//     const dpr = Math.min(2, window.devicePixelRatio || 1);

//     const resize = () => {
//       const w = Math.max(1, c.clientWidth);
//       const h = Math.max(1, c.clientHeight);
//       c.width = Math.round(w * dpr);
//       c.height = Math.round(h * dpr);
//       ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
//       ctx.imageSmoothingEnabled = true;
//       // @ts-ignore
//       if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
//     };
//     resize();
//     const ro = new ResizeObserver(resize);
//     ro.observe(c);

//     const drawLoop = (t: number) => {
//       if (cancelled) return;

//       const imgs = imgsRef.current;
//       if (!imgs || imgs.length === 0) {
//         rafRef.current = requestAnimationFrame(drawLoop);
//         return;
//       }

//       const N = imgs.length;
//       const frame = Math.floor((t * fpsRef.current) / 1000) % N;   // absolute time → no restarts
//       const img = imgs[frame]!;
//       const iw = (img as any).naturalWidth ?? (img as any).width ?? 1;
//       const ih = (img as any).naturalHeight ?? (img as any).height ?? 1;

//       const cw = c.width / dpr, ch = c.height / dpr;
//       ctx.clearRect(0, 0, cw, ch);

//       // contain-fit
//       const ir = iw / ih, cr = cw / ch;
//       let dw = cw, dh = ch;
//       if (ir > cr) { dh = cw / ir; } else { dw = ch * ir; }
//       const dx = (cw - dw) / 2, dy = (ch - dh) / 2;

//       ctx.drawImage(img as any, dx, dy, dw, dh);

//       rafRef.current = requestAnimationFrame(drawLoop);
//     };

//     const key = keyOfFrames(frames);
//     const cached = BITMAP_CACHE.get(key);

//     (async () => {
//       const decoded = cached ?? await decodeFrames(frames);
//       if (cancelled) return;
//       if (!cached) BITMAP_CACHE.set(key, decoded);
//       imgsRef.current = decoded;
//       if (!rafRef.current) rafRef.current = requestAnimationFrame(drawLoop);
//     })();

//     return () => {
//       cancelled = true;
//       if (rafRef.current) cancelAnimationFrame(rafRef.current);
//       rafRef.current = null;
//       ro.disconnect();
//     };
//   }, [frames]);

//   return (
//     <canvas
//       ref={canvasRef}
//       className={className}
//       style={{ width: "100%", height: "100%", display: "block", ...style }}
//     />
//   );
// });

// export default SideSpin;
