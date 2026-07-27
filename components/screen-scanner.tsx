"use client";

import React, { useEffect, useRef, useState } from "react";

// QR scanner rendered inside the kiosk screen glass (the drop-up panel).
// Live camera feed + a real QR decoder:
//   - native BarcodeDetector when the browser has it
//   - jsQR (canvas sampling) everywhere else
// Demo scope: we surface the decoded text on-screen and keep scanning — no
// business logic hangs off the result yet.
//
// The scanning indicator is the four rounded orange corner brackets (matching
// the supplied reference) + a sweeping scan line; on a successful read the
// brackets flash with the global illumination bloom (see global.md).

const ORANGE = "#F5852A";

const css = `
  .scanner-ui{
    position:absolute;left:7.28%;top:6.743%;width:87.157%;height:85.211%;
    border-radius:3% / 3%;overflow:hidden;background:#000;
    font-family:'Rajdhani',sans-serif;
  }
  .scanner-ui video{
    position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
    background:#000;
  }

  /* corner-bracket scanning indicator (rounded outer corners, short arms) */
  .scan-frame{
    position:absolute;left:50%;top:47%;translate:-50% -50%;
    height:68%;aspect-ratio:1;pointer-events:none;
    transition:filter .25s ease;
  }
  .scan-frame .corner{
    position:absolute;width:26%;height:26%;
    border:0 solid ${ORANGE};
    filter:drop-shadow(0 0 4px rgba(245,133,42,.55));
  }
  .scan-frame .tl{left:0;top:0;border-left-width:3px;border-top-width:3px;border-top-left-radius:14px}
  .scan-frame .tr{right:0;top:0;border-right-width:3px;border-top-width:3px;border-top-right-radius:14px}
  .scan-frame .bl{left:0;bottom:0;border-left-width:3px;border-bottom-width:3px;border-bottom-left-radius:14px}
  .scan-frame .br{right:0;bottom:0;border-right-width:3px;border-bottom-width:3px;border-bottom-right-radius:14px}
  /* successful read → brackets take the global illumination bloom */
  .scanner-ui.is-found .scan-frame{filter:url(#illuminate-ui)}

  /* sweeping scan line inside the bracket area */
  .scan-line{
    position:absolute;left:6%;right:6%;top:0;height:2.5px;border-radius:99px;
    background:linear-gradient(90deg,transparent,${ORANGE} 18%,#ffc98f 50%,${ORANGE} 82%,transparent);
    box-shadow:0 0 9px 1px rgba(245,133,42,.65);
    animation:scan-sweep 2.3s cubic-bezier(.45,.05,.55,.95) infinite;
  }
  @keyframes scan-sweep{0%{top:3%}50%{top:96%}100%{top:3%}}
  .scanner-ui.is-found .scan-line,
  .scanner-ui.is-error .scan-line,
  .scanner-ui.is-starting .scan-line{display:none}

  /* status readout pinned to the bottom of the glass — clean, wide, high-contrast
     uppercase so it stays legible over the live feed */
  .scan-status{
    position:absolute;left:4%;right:4%;bottom:3.4%;z-index:3;text-align:center;
    font-family:'Saira',system-ui,-apple-system,'Segoe UI',sans-serif;
    font-weight:600;text-transform:uppercase;letter-spacing:2px;
    font-size:clamp(12px,3.2vw,16px);line-height:1.25;color:#f2f2f2;
    text-shadow:0 1px 5px rgba(0,0,0,.95);
    -webkit-user-select:none;user-select:none;
  }
  .scan-status .val{
    display:block;margin-top:3px;color:${ORANGE};text-transform:none;
    letter-spacing:.3px;font-weight:600;word-break:break-all;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
  }
  .scanner-ui.is-found .scan-status .lbl{color:${ORANGE}}

  /* dark vignette so the readout stays legible over any feed */
  .scan-shade{
    position:absolute;inset:0;pointer-events:none;
    background:linear-gradient(180deg,rgba(0,0,0,.42),transparent 22%,transparent 66%,rgba(0,0,0,.6));
  }
`;

type ScanState = "starting" | "scanning" | "found" | "error";

export const ScreenScanner: React.FC<{
  active: boolean;
  // Called with a decoded code; may return a status message to display
  // (e.g. "+50 points!"). Lets the reward engine hang off a scan.
  onDetected?: (code: string) => Promise<string | void>;
}> = ({ active, onDetected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHandledRef = useRef<string>("");
  // Keep the latest handler in a ref so scans use current auth without
  // restarting the camera (the effect only depends on `active`).
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [state, setState] = useState<ScanState>("starting");
  const [result, setResult] = useState("");

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const video = videoRef.current;
    if (!video) return;

    setState("starting");
    setResult("");

    const onFound = (text: string) => {
      setResult(text);
      setState("found");
      // Hand the code to the reward engine once per hold window (avoid firing
      // repeatedly while the same code stays in frame).
      if (onDetectedRef.current && lastHandledRef.current !== text) {
        lastHandledRef.current = text;
        onDetectedRef.current(text)
          .then((msg) => {
            if (msg && !stopped) setResult(msg);
          })
          .catch(() => {});
      }
      // hold the result for a moment, then resume scanning
      if (resumeRef.current) clearTimeout(resumeRef.current);
      resumeRef.current = setTimeout(() => {
        if (!stopped) {
          setState("scanning");
          lastHandledRef.current = "";
        }
      }, 2800);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        setState("scanning");

        // decoder: native BarcodeDetector → jsQR fallback
        let detector: any = null;
        const BD = (window as any).BarcodeDetector;
        if (BD) {
          try {
            const formats: string[] = await BD.getSupportedFormats();
            if (formats.includes("qr_code"))
              detector = new BD({ formats: ["qr_code"] });
          } catch {
            /* fall through to jsQR */
          }
        }
        let jsQR: any = null;
        if (!detector) jsQR = (await import("jsqr")).default;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        const tick = async () => {
          if (stopped) return;
          if (video.readyState >= 2 && video.videoWidth > 0) {
            try {
              if (detector) {
                const codes = await detector.detect(video);
                if (codes.length && codes[0].rawValue) onFound(codes[0].rawValue);
              } else if (ctx && jsQR) {
                // downscale for decode performance
                const w = 400;
                const h = Math.round((w * video.videoHeight) / video.videoWidth);
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(video, 0, 0, w, h);
                const img = ctx.getImageData(0, 0, w, h);
                const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
                if (code?.data) onFound(code.data);
              }
            } catch {
              /* transient decode errors are fine — next frame */
            }
          }
          timer = setTimeout(tick, 170);
        };
        tick();
      } catch {
        if (!stopped) setState("error");
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (resumeRef.current) clearTimeout(resumeRef.current);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [active]);

  const label =
    state === "starting"
      ? "Starting camera…"
      : state === "error"
        ? "Camera unavailable — allow camera access"
        : state === "found"
          ? "QR code detected"
          : "Scan QR code";

  return (
    <div
      className={`scanner-ui is-${state}`}
      role="region"
      aria-label="QR code scanner"
      aria-hidden={!active}
    >
      <style>{css}</style>
      <video ref={videoRef} muted playsInline />
      <div className="scan-shade" />
      <div className="scan-frame" aria-hidden>
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />
        {(state === "scanning" || state === "found") && <span className="scan-line" />}
      </div>
      <div className="scan-status" aria-live="polite">
        <span className="lbl">{label}</span>
        {state === "found" && result && <span className="val">{result}</span>}
      </div>
    </div>
  );
};
