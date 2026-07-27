"use client";

import React, { useEffect, useRef } from "react";

// SHOP page section — demo layout: the product card (chrome rebuilt to match
// the supplied neon reference: dark card, glowing orange inner frame, PACKS
// title + item count, circular chevron button) with the ORIGINAL depth-lit
// product images as the visual area, and a demo title + description on the
// card's right. Same side-by-side layout on mobile.
//
// The hover features from the source spotlight card are all preserved:
//  - WebGL depth-map spotlight that tracks the pointer (light + shadows + AO)
//  - scroll-snap carousel with scroll-driven marker indicators
//  - hover-delay card dim (title/button stay crisp above the dim)
//  - chevron button: background deepens + double-chevron slide-through

const HOVER_DELAY_MS = 150;
const ORANGE = "#F5852A";

/* ── card markup: injected verbatim so the view-timeline inline styles and
      custom elements survive React ── */
type Product = {
  id: string; // unique per card (ids + scroll-timeline names)
  title: string;
  count: string;
  // depth "flat" = no authored depth map: the spotlight still tracks the
  // pointer as a clean light sweep, without fake-3D shading artifacts.
  // zoom < 1 shows the image zoomed out (edge-clamped) so oversized product
  // shots match the shoes' ~55%-of-frame composition.
  slides: { src: string; depth: string; zoom?: number }[];
};

const PRODUCTS: Product[] = [
  {
    id: "packs",
    title: "Packs",
    count: "24 items",
    slides: [
      {
        src: "https://assets.codepen.io/605876/volar-nimbus-4s.png",
        depth: "https://assets.codepen.io/605876/volar-nimbus-4s-depth.png",
      },
      {
        src: "https://assets.codepen.io/605876/volar-nimbus-4s-side.png",
        depth: "https://assets.codepen.io/605876/volar-nimbus-4s-side-depth.png",
      },
      {
        src: "https://assets.codepen.io/605876/volar-nimbus-4s-under.png",
        depth: "https://assets.codepen.io/605876/volar-nimbus-4s-under-depth.png",
      },
      {
        src: "https://assets.codepen.io/605876/volar-nimbus-4s-top.png",
        depth: "https://assets.codepen.io/605876/volar-nimbus-4s-top-depth.png",
      },
    ],
  },
  {
    id: "caps",
    title: "Caps",
    count: "12 items",
    // the source caps are transparent PNGs at inconsistent scales — each was
    // composited onto the same synthetic studio backdrop (color-matched to the
    // shoe images: charcoal wall → light floor) at the shoes' ~56% framing
    slides: [
      { src: "/shop/cap-1-banner.png", depth: "flat" },
      { src: "/shop/cap-2-banner.png?v=2", depth: "flat" },
      { src: "/shop/cap-3-banner.png?v=2", depth: "flat" },
    ],
  },
];

function cardHtml(p: Product) {
  const tl = (i: number) => `--${p.id}-v${i + 1}`;
  const scope = p.slides.map((_, i) => tl(i)).join(", ");
  const slides = p.slides
    .map(
      (s, i) => `
          <li style="view-timeline: ${tl(i)} inline">
            <product-spotlight src="${s.src}" depth="${s.depth}"${s.zoom ? ` zoom="${s.zoom}"` : ""}></product-spotlight>
          </li>`,
    )
    .join("");
  const markers = p.slides
    .map(
      (_, i) => `
          <button type="button" role="tab" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"
            aria-label="Slide ${i + 1} of ${p.slides.length}" style="--timeline: ${tl(i)}"></button>`,
    )
    .join("");
  return `
  <article class="card" style="timeline-scope: ${scope}; --slides: ${p.slides.length}">
    <div class="card__frame">
      <spotlight-carousel class="card__spotlight-carousel">
        <ul>${slides}
        </ul>
        <div class="carousel__markers" role="tablist" aria-label="Product slides">${markers}
        </div>
      </spotlight-carousel>
      <div class="card__body">
        <div class="card__meta">
          <h2 id="${p.id}-title">${p.title}</h2>
          <p class="count">${p.count}</p>
        </div>
        <a href="#" aria-labelledby="${p.id}-open ${p.id}-title">
          <span class="sr-only" id="${p.id}-open">Open</span>
          <span class="icons">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m6 4 4 4-4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m6 4 4 4-4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </a>
      </div>
    </div>
  </article>
`;
}

/* ── styles ── */
const css = `
  .shop-section{
    min-height:calc(100dvh - var(--bottom-nav-h,160px) - env(safe-area-inset-bottom) - 180px);
    border:1.5px solid #4A4A4A;border-top:none;border-bottom:none;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:clamp(28px,6vw,72px);
    padding:clamp(16px,4vw,48px);
  }
  .shop-wrap{
    --hover-delay:${HOVER_DELAY_MS}ms;
    display:flex;flex-direction:row;align-items:center;
    gap:clamp(14px,3.5vw,44px);
    max-width:900px;width:100%;
  }
  .shop-stage{flex:none}
  .shop-copy{flex:1;min-width:0}
  .shop-copy .kicker{
    font-family:'Rajdhani',sans-serif;font-weight:700;text-transform:uppercase;
    letter-spacing:.3em;font-size:clamp(13px,2.2vw,17px);color:#F2F2F2;margin:0 0 8px;
  }
  /* product titles carry the global illumination bloom (see global.md):
     brand orange + the shared #illuminate-ui filter from the octagon toolbar */
  .shop-copy h1{
    font-family:'Rajdhani',sans-serif;font-weight:700;text-transform:uppercase;
    letter-spacing:.06em;font-size:clamp(26px,5.6vw,54px);color:#F5852A;margin:0 0 12px;
    line-height:1.05;filter:url(#illuminate-ui);
  }
  .shop-copy p{
    font-family:'Saira',sans-serif;font-weight:400;font-size:clamp(14px,2.9vw,21px);
    line-height:1.55;color:#8C8C8C;margin:0;
  }

  .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
    clip:rect(0,0,0,0);white-space:nowrap;border-width:0}

  /* ── the card: neon chrome + spotlight image area ─────────── */
  .shop-stage .card{
    position:relative;width:min(320px,46vw);aspect-ratio:553/676;
    background:#050505;border-radius:9.5%/7.8%;padding:5.4%;
    cursor:pointer;-webkit-tap-highlight-color:#0000;container-type:inline-size;
    box-shadow:0 1px 0 0 hsl(0 0% 100% / .05) inset,0 8px 26px -10px hsl(0 0% 0% / .8);
  }
  .shop-stage .card:has(a:focus-visible){outline:2px solid white;outline-offset:2px}

  /* glowing inner frame — the glow is top-weighted (reference): the top border
     runs hotter with a bloom above it, fading down the sides to a subtler
     bottom edge */
  .shop-stage .card__frame{
    position:relative;width:100%;height:100%;border-radius:7.5%/6.2%;
    border:2.5px solid transparent;overflow:hidden;
    display:flex;flex-direction:column;
    background:
      radial-gradient(130% 85% at 50% 24%,rgba(245,133,42,.14),rgba(245,133,42,.04) 46%,transparent 68%),
      #070605;
    box-shadow:
      0 -3px 14px rgba(245,133,42,.60),
      0 -10px 34px rgba(245,133,42,.30),
      0 0 7px rgba(245,133,42,.13),
      0 4px 14px rgba(245,133,42,.04),
      inset 0 8px 22px rgba(245,133,42,.20),
      inset 0 0 16px rgba(245,133,42,.06),
      inset 0 0 46px rgba(245,133,42,.04);
  }
  /* the border line itself: a gradient ring, hot at the top → dimmer bottom.
     Drawn on .card (the frame's overflow:hidden would clip it): the card's
     5.4%-of-width padding = 4.417% of its height (aspect 553/676). */
  .shop-stage .card::before{
    content:'';position:absolute;left:5.4%;right:5.4%;top:4.417%;bottom:4.417%;
    border-radius:7.5%/6.2%;padding:2.5px;
    background:linear-gradient(180deg,
      #ffb066 0%,#ff9840 12%,${ORANGE} 30%,
      rgba(245,133,42,.60) 62%,rgba(216,108,28,.40) 100%);
    -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
    -webkit-mask-composite:xor;mask-composite:exclude;
    pointer-events:none;z-index:5;
  }

  /* ── spotlight carousel (same product images + backdrop as the source) ── */
  .shop-stage product-spotlight{
    display:block;aspect-ratio:385/315;overflow:hidden;position:relative;z-index:2;
    flex:1 0 auto;height:100%;width:100%;
  }
  .shop-stage spotlight-carousel{display:block}
  .shop-stage .card__spotlight-carousel{
    aspect-ratio:385/315;width:100%;position:relative;z-index:2;flex:none;
    > ul{
      width:100%;height:100%;margin:0;padding:0;list-style-type:none;display:flex;
      overflow:auto;overscroll-behavior:none;scroll-snap-type:x mandatory;
      scrollbar-color:#0000 #0000;border-radius:0 0 18px 18px;
      outline-color:#fff;outline-offset:2px;outline-width:2px;
      li{scroll-snap-align:center;width:100%;height:100%;flex:1 0 100%}
    }
  }
  .shop-stage .carousel__markers{
    position:absolute;top:calc(100% + 7px);translate:-50% 0;left:50%;right:0;z-index:3;
    display:flex;height:12px;justify-content:center;aspect-ratio:6/1;
    button{
      all:unset;width:12px;height:12px;cursor:pointer;position:relative;box-sizing:border-box;
      opacity:.22;flex:1;border-radius:100px;min-width:12px;max-height:12px;padding:0;
      border:3.5px solid transparent;
      &::after{content:'';position:absolute;inset:0;border-radius:100px;background:#fff}
      @supports (animation-timeline: scroll()){
        animation:shop-indicate both linear;animation-timeline:var(--timeline);
      }
      @supports not (animation-timeline: scroll()){
        &[aria-selected='true']{opacity:.6}
      }
      &:focus-visible{outline:2px solid white;outline-offset:2px}
    }
  }
  @keyframes shop-indicate{50%{flex:5;opacity:.6}}

  /* hover-delay dim — covers the frame (images included) but paints before the
     body's children, so the title/count/button stay crisp (source-card trick) */
  .shop-stage .card__body::before{
    content:'';position:absolute;inset:0;border-radius:inherit;opacity:0;
    background:hsl(0 0% 0% / .3);transition:opacity .16s ease-out;
    pointer-events:none;z-index:2;
  }

  .shop-stage .card__body{
    flex:1;display:flex;align-items:center;justify-content:space-between;gap:8px;
    padding:5% 8.5% 2%;
  }
  .shop-stage .card__meta{display:grid;gap:1px;min-width:0;position:relative;z-index:3}
  .shop-stage .card__meta h2{
    margin:0;font-family:'Saira',sans-serif;font-weight:500;
    font-size:clamp(17px,7.6cqw,30px);letter-spacing:1px;line-height:1.1;
    color:#F2F2F2;text-transform:uppercase;
  }
  .shop-stage .card__meta .count{
    margin:0;font-family:'Saira',sans-serif;font-weight:400;
    font-size:clamp(10px,4cqw,16px);letter-spacing:1.5px;
    color:#8f8f8d;text-transform:uppercase;
  }

  /* circular chevron button — keeps the source card's buy-button hover:
     bg deepens + the double-chevron slides through after the hover delay */
  .shop-stage .card__body a{
    color:inherit;text-decoration:none;outline:none;flex:none;position:relative;z-index:3;
    width:17.5%;aspect-ratio:1;border-radius:50%;
    display:grid;place-items:end;overflow:hidden;
    background:rgba(12,8,4,.85);
    border:1.5px solid rgba(245,133,42,.5);
    box-shadow:0 0 10px rgba(245,133,42,.3),inset 0 0 8px rgba(245,133,42,.12);
    transition:background .16s ease-out,box-shadow .16s ease-out;
  }
  .shop-stage .card__body a .icons{
    height:100%;width:200%;display:grid;grid-template-columns:1fr 1fr;place-items:center;
  }
  .shop-stage .card__body a svg{width:42%;opacity:.75;transition:opacity .18s ease-out;color:#fff}

  /* ── hover choreography (from the source card, hover-delay intact) ── */
  .shop-stage .card:is(:hover,:has(:focus-visible)){
    .card__body::before{opacity:1;transition-delay:var(--hover-delay)}
    a{background:#000;box-shadow:0 0 14px rgba(245,133,42,.45),inset 0 0 8px rgba(245,133,42,.18);
      transition-delay:var(--hover-delay)}
    .icons{
      translate:50% 0;transition:translate .16s var(--hover-delay) ease-out;
      svg{opacity:1;transition-delay:var(--hover-delay)}
    }
  }

  @media (max-width:640px){
    .shop-stage .card{width:min(300px,50vw)}
  }
`;

/* ── one-time client registration of the spotlight web components ── */
function registerShopElements() {
  if (typeof window === "undefined") return;
  if (customElements.get("product-spotlight")) return;

  /* lighting params — the demo's "Default" preset */
  const P = {
    lightHeight: 1.45, shadowStrength: 1, shadowSoftness: 0.044,
    minBrightness: 0.2, normalStrength: 1.5, parallax: 0, aoStrength: 0.3,
    shadowLength: 1.7, lightBoost: 0.6, highlight: 2.55, spotRadius: 0.31,
    spotFloor: 0.14, spotFalloff: 1.0, spotColor: "#ffffff",
    trackingSpeed: 50, returnSpeed: 350, fadeIn: 60, fadeOut: 200,
    hoverDelay: HOVER_DELAY_MS, spotlightMode: "slide",
  };

  const V = `
attribute vec2 aPos;attribute vec2 aTex;varying vec2 vUv;
void main(){vUv=aTex;gl_Position=vec4(aPos,0.0,1.0);}`;
  const F = `
precision highp float;
uniform sampler2D uImage;uniform sampler2D uDepth;
uniform vec2 uMouse;uniform vec2 uRes;
uniform float uLightH;uniform float uStrength;uniform float uSoft;uniform float uMinBri;
uniform float uNorm;uniform float uPara;uniform float uAO;uniform float uHover;
uniform float uSpotR;uniform float uSpotFloor;uniform float uShadLen;uniform float uBoost;
uniform float uHighlight;uniform float uSpotFalloff;uniform vec3 uSpotColor;
uniform vec2 uUvScale;uniform vec2 uUvOffset;
varying vec2 vUv;
vec2 coverUv(vec2 uv){return uv*uUvScale+uUvOffset;}
vec3 getNormal(vec2 uv,vec2 tx){
  float l=texture2D(uDepth,coverUv(uv-vec2(tx.x,0.0))).r;
  float r=texture2D(uDepth,coverUv(uv+vec2(tx.x,0.0))).r;
  float u=texture2D(uDepth,coverUv(uv+vec2(0.0,tx.y))).r;
  float d=texture2D(uDepth,coverUv(uv-vec2(0.0,tx.y))).r;
  return normalize(vec3((l-r)*uNorm,(d-u)*uNorm,1.0));
}
float traceShadow(vec2 uv,float depth,vec2 lp,float lH,float soft,float sLen){
  vec3 orig=vec3(uv,depth);vec3 target=vec3(lp,lH);vec3 ray=(target-orig)*sLen;
  float penumbra=1e5;const int S=24;
  for(int i=2;i<=S;i++){
    float t=float(i)/float(S);vec3 pos=orig+ray*t;
    if(pos.x<0.0||pos.x>1.0||pos.y<0.0||pos.y>1.0)break;
    float sd=texture2D(uDepth,coverUv(pos.xy)).r;float diff=sd-pos.z;
    if(diff>0.008){penumbra=min(penumbra,soft*float(i)/diff);}
  }
  return clamp(penumbra,0.0,1.0);
}
float calcAO(vec2 uv,vec2 tx){
  float c=texture2D(uDepth,coverUv(uv)).r;float s=0.0;
  for(int i=0;i<8;i++){
    float a=float(i)*0.7854;vec2 o=vec2(cos(a),sin(a))*tx*3.0;
    s+=max(c-texture2D(uDepth,coverUv(uv+o)).r,0.0);
  }
  return clamp(1.0-s*uAO*12.0/8.0,0.0,1.0);
}
void main(){
  vec2 tx=1.0/uRes;
  float depth=texture2D(uDepth,coverUv(vUv)).r;
  vec2 pOff=(uMouse-vUv)*depth*uPara*uHover;
  vec2 uv=clamp(vUv+pOff,vec2(0.0),vec2(1.0));
  vec4 col=texture2D(uImage,coverUv(uv));
  float d=texture2D(uDepth,coverUv(uv)).r;
  vec3 N=getNormal(uv,tx);float ao=calcAO(uv,tx);
  vec3 L=normalize(vec3(uMouse,uLightH)-vec3(uv,d));
  float NdotL=max(dot(N,L),0.0);
  float dist=length(vec3(uMouse,uLightH)-vec3(uv,d));
  float atten=1.0/(1.0+dist*dist*1.5);
  float shad=traceShadow(uv,d,uMouse,uLightH,uSoft,uShadLen);
  float light=NdotL*atten*shad*ao;
  float factor=mix(uMinBri,1.0,light);
  factor=mix(1.0,factor,uStrength);factor=min(factor,1.0);
  float aspect=uRes.x/uRes.y;
  float sDist=length((uMouse-uv)*vec2(aspect,1.0));
  float spot=exp(-sDist*sDist/(uSpotR*uSpotR));
  vec2 cp=clamp(uMouse,vec2(0.001),vec2(0.999));
  float ld=texture2D(uDepth,coverUv(cp)).r;
  float behind=max(ld-d,0.0);
  spot*=mix(1.0,1.0-smoothstep(0.0,0.25,behind),0.8);
  spot=pow(spot,uSpotFalloff);
  float spotMul=mix(uSpotFloor,uHighlight,spot);
  vec3 boostRGB=uSpotColor*spot*light*uBoost;
  float finalBri=mix(1.0,max(factor*spotMul,uSpotFloor),uHover);
  col.rgb=col.rgb*finalBri+col.rgb*boostRGB*uHover;
  gl_FragColor=col;
}`;

  function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ];
  }
  function msToLerp(ms: number) {
    if (ms <= 0) return 1;
    const frames = (ms / 1000) * 60;
    return 1 - Math.exp(-3 / frames);
  }

  /* shared WebGL context on one offscreen canvas */
  let gl: WebGLRenderingContext | null = null;
  let glCanvas: HTMLCanvasElement;
  const uni: Record<string, WebGLUniformLocation | null> = {};
  const texCache = new Map<string, any>();
  let glReady = false;

  function compileShader(ctx: WebGLRenderingContext, type: number, src: string) {
    const s = ctx.createShader(type)!;
    ctx.shaderSource(s, src);
    ctx.compileShader(s);
    if (!ctx.getShaderParameter(s, ctx.COMPILE_STATUS)) {
      console.warn("Shader compile error:", ctx.getShaderInfoLog(s));
    }
    return s;
  }
  /* constant mid-gray depth for products without an authored depth map:
     flat normals + no traced shadows/AO → a clean pointer-tracked light sweep */
  let flatDepthCanvas: HTMLCanvasElement | null = null;
  function getFlatDepth() {
    if (!flatDepthCanvas) {
      flatDepthCanvas = document.createElement("canvas");
      flatDepthCanvas.width = flatDepthCanvas.height = 4;
      const c = flatDepthCanvas.getContext("2d")!;
      c.fillStyle = "#808080";
      c.fillRect(0, 0, 4, 4);
    }
    return flatDepthCanvas;
  }

  function makeTexture(ctx: WebGLRenderingContext, img: HTMLImageElement | HTMLCanvasElement) {
    const t = ctx.createTexture();
    ctx.bindTexture(ctx.TEXTURE_2D, t);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR);
    ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, img);
    return t;
  }
  function initSharedGL() {
    if (glReady) return;
    glCanvas = document.createElement("canvas");
    gl = glCanvas.getContext("webgl", {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) return;
    const vs = compileShader(gl, gl.VERTEX_SHADER, V);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, F);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("Program link error:", gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, 1, 1, 1, 0]),
      gl.STATIC_DRAW,
    );
    const aP = gl.getAttribLocation(prog, "aPos");
    const aT = gl.getAttribLocation(prog, "aTex");
    gl.enableVertexAttribArray(aP);
    gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aT);
    gl.vertexAttribPointer(aT, 2, gl.FLOAT, false, 16, 8);
    const names = [
      "uImage","uDepth","uMouse","uRes","uLightH","uStrength","uSoft","uMinBri",
      "uNorm","uPara","uAO","uHover","uSpotR","uSpotFloor","uShadLen","uBoost",
      "uHighlight","uSpotFalloff","uSpotColor","uUvScale","uUvOffset",
    ];
    for (const n of names) uni[n] = gl.getUniformLocation(prog, n);
    gl.uniform1i(uni.uImage, 0);
    gl.uniform1i(uni.uDepth, 1);
    glReady = true;
  }
  function getTextures(
    imgEl: HTMLImageElement,
    depEl: HTMLImageElement | HTMLCanvasElement,
    key: string,
  ) {
    if (texCache.has(key)) return texCache.get(key);
    const t = {
      img: makeTexture(gl!, imgEl),
      dep: makeTexture(gl!, depEl),
      imgW: imgEl.naturalWidth,
      imgH: imgEl.naturalHeight,
    };
    texCache.set(key, t);
    return t;
  }

  /* single-rAF render manager */
  const renderManager = {
    active: new Set<any>(),
    running: false,
    add(inst: any) { this.active.add(inst); this._start(); },
    remove(inst: any) {
      this.active.delete(inst);
      if (this.active.size === 0) this.running = false;
    },
    wake(inst: any) {
      // lazy re-init: if a spotlight failed to set up (e.g. GL context wasn't
      // ready at load), the first interaction retries instead of staying dead
      if (!inst._inited) {
        inst._setup?.();
        return;
      }
      this.active.add(inst);
      this._start();
    },
    _start() {
      if (!this.running) {
        this.running = true;
        requestAnimationFrame(this._loop);
      }
    },
    _loop: () => {
      for (const inst of renderManager.active) {
        const settled = inst.render();
        if (settled) renderManager.active.delete(inst);
      }
      if (renderManager.active.size === 0) renderManager.running = false;
      else requestAnimationFrame(renderManager._loop);
    },
  };

  const imageCache = new Map<string, Promise<HTMLImageElement>>();
  function loadImage(url: string) {
    if (imageCache.has(url)) return imageCache.get(url)!;
    const p = new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = url;
    });
    imageCache.set(url, p);
    return p;
  }

  function computeCoverUv(
    imgW: number,
    imgH: number,
    canvasW: number,
    canvasH: number,
    zoom = 1,
  ) {
    const imgAspect = imgW / imgH;
    const canvasAspect = canvasW / canvasH;
    let scaleX = 1, scaleY = 1;
    if (imgAspect > canvasAspect) {
      scaleX = canvasAspect / imgAspect;
    } else {
      scaleY = imgAspect / canvasAspect;
    }
    // zoom < 1 samples a larger source area (zoomed out); the sampler's
    // CLAMP_TO_EDGE extends the backdrop past the image bounds
    scaleX /= zoom;
    scaleY /= zoom;
    const offX = (1 - scaleX) / 2;
    const offY = (1 - scaleY) / 2;
    return { scaleX, scaleY, offX, offY };
  }

  class ProductSpotlight extends HTMLElement {
    _mouse = { x: 0.5, y: 0.5 };
    _sm = { x: 0.5, y: 0.5 };
    _hov = false;
    _focused = false;
    _hm = 0;
    _inited = false;
    _tex: any = null;
    _ctx2d: CanvasRenderingContext2D | null = null;
    _w = 0;
    _h = 0;
    _cover = { scaleX: 1, scaleY: 1, offX: 0, offY: 0 };
    _hoverTimer: any = null;
    _mouseOver = false;
    _canvas!: HTMLCanvasElement;
    _observer: IntersectionObserver | null = null;
    _carousel: any = null;
    _slideIndex = 0;
    _hasRendered = false;
    _zoom = 1;

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }
    connectedCallback() {
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "display:block;width:100%;height:100%;";
      this.shadowRoot!.appendChild(canvas);
      this._canvas = canvas;
      this._zoom = parseFloat(this.getAttribute("zoom") || "1") || 1;
      const src = this.getAttribute("src");
      if (src) {
        loadImage(src)
          .then((img) => {
            if (this._inited) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const rect = this.getBoundingClientRect();
            const w = Math.round(rect.width * dpr);
            const h = Math.round(rect.height * dpr);
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d")!;
            const imgAspect = img.naturalWidth / img.naturalHeight;
            const canvasAspect = w / h;
            let sw, sh, sx, sy;
            if (imgAspect > canvasAspect) {
              sh = img.naturalHeight;
              sw = sh * canvasAspect;
              sx = (img.naturalWidth - sw) / 2;
              sy = 0;
            } else {
              sw = img.naturalWidth;
              sh = sw / canvasAspect;
              sx = 0;
              sy = (img.naturalHeight - sh) / 2;
            }
            // zoom-out preview: widen the source rect, clamped to the image
            // (close enough until the GL pass takes over with true edge-clamp)
            if (this._zoom !== 1) {
              const z = this._zoom;
              const nw = sw / z, nh = sh / z;
              sx = Math.max(0, sx - (nw - sw) / 2);
              sy = Math.max(0, sy - (nh - sh) / 2);
              sw = Math.min(img.naturalWidth - sx, nw);
              sh = Math.min(img.naturalHeight - sy, nh);
            }
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
          })
          .catch(() => {});
      }
      const carousel: any = this.closest("spotlight-carousel");
      const pointerTarget: any = carousel || canvas;
      const card = this.closest("article, .card") as any;
      const getSiblings = () =>
        carousel ? [...carousel.querySelectorAll("product-spotlight")] : [this];
      if (!pointerTarget._spotlightBound) {
        pointerTarget._spotlightBound = true;
        pointerTarget.addEventListener("pointermove", (e: PointerEvent) => {
          if ((e.target as Element).closest('[role="tablist"]')) return;
          const r = pointerTarget.getBoundingClientRect();
          const mx = (e.clientX - r.left) / r.width;
          const my = (e.clientY - r.top) / r.height;
          for (const sp of getSiblings() as any[]) {
            sp._mouse.x = mx;
            sp._mouse.y = my;
            renderManager.wake(sp);
            if (!sp._mouseOver) {
              sp._mouseOver = true;
              sp._hoverTimer = setTimeout(() => {
                sp._hov = true;
                renderManager.wake(sp);
              }, P.hoverDelay);
            }
          }
        });
        pointerTarget.addEventListener("pointerleave", () => {
          for (const sp of getSiblings() as any[]) {
            sp._mouseOver = false;
            clearTimeout(sp._hoverTimer);
            sp._hov = false;
            renderManager.wake(sp);
          }
        });
      }
      if (card && !card._spotlightFocusBound) {
        card._spotlightFocusBound = true;
        card.addEventListener("focusin", (e: FocusEvent) => {
          if ((e.target as Element).closest('[role="tablist"]')) return;
          for (const sp of getSiblings() as any[]) {
            sp._focused = true;
            sp._mouse.x = 0.5;
            sp._mouse.y = 0.5;
            renderManager.wake(sp);
          }
        });
        card.addEventListener("focusout", (e: FocusEvent) => {
          if ((e.relatedTarget as Element)?.closest('[role="tablist"]')) return;
          for (const sp of getSiblings() as any[]) {
            sp._focused = false;
            renderManager.wake(sp);
          }
        });
      }
      this._observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              if (!this._inited) this._setup();
              else renderManager.add(this);
            } else {
              renderManager.remove(this);
            }
          }
        },
        { threshold: 0 },
      );
      this._observer.observe(this);
      // belt & braces: init as soon as the element has layout, without waiting
      // on the observer (which fires only once at load and never retries)
      const tryInit = (attempt: number) => {
        if (this._inited || !this.isConnected || attempt > 30) return;
        if (this.getBoundingClientRect().width > 0) this._setup();
        else requestAnimationFrame(() => tryInit(attempt + 1));
      };
      requestAnimationFrame(() => tryInit(0));
    }
    disconnectedCallback() {
      if (this._observer) this._observer.disconnect();
      clearTimeout(this._hoverTimer);
      renderManager.remove(this);
    }
    async _setup() {
      if (this._inited) return;
      const src = this.getAttribute("src");
      const depth = this.getAttribute("depth") || "flat";
      if (!src) return;
      let imgEl: HTMLImageElement;
      let depEl: HTMLImageElement | HTMLCanvasElement;
      try {
        imgEl = await loadImage(src);
        depEl = depth === "flat" ? getFlatDepth() : await loadImage(depth);
      } catch {
        return;
      }
      initSharedGL();
      if (!glReady) {
        // GL context can fail transiently right at page load — retry briefly
        const tries = ((this as any)._glTries = ((this as any)._glTries || 0) + 1);
        if (tries < 6) setTimeout(() => this._setup(), 400);
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = this.getBoundingClientRect();
      this._w = Math.round(rect.width * dpr);
      this._h = Math.round(rect.height * dpr);
      const cv = this._canvas;
      cv.width = this._w;
      cv.height = this._h;
      this._ctx2d = cv.getContext("2d");
      this._carousel = this.closest("spotlight-carousel");
      if (this._carousel) {
        const lis = this._carousel.querySelectorAll(":scope > ul > li");
        this._slideIndex = [...lis].indexOf(this.closest("li"));
      } else {
        this._slideIndex = 0;
      }
      this._tex = getTextures(imgEl, depEl, `${src}|${depth}`);
      this._cover = computeCoverUv(
        this._tex.imgW,
        this._tex.imgH,
        this._w,
        this._h,
        this._zoom,
      );
      this._inited = true;
      renderManager.add(this);
    }
    render() {
      if (!this._inited || !this._ctx2d || !gl) return true;
      const active = this._hov || this._focused;
      const lr = msToLerp(active ? P.trackingSpeed : P.returnSpeed);
      const tx = active ? this._mouse.x : 0.5;
      const ty = active ? this._mouse.y : 0.5;
      this._sm.x += (tx - this._sm.x) * lr;
      this._sm.y += (ty - this._sm.y) * lr;
      this._hm += ((active ? 1 : 0) - this._hm) * msToLerp(active ? P.fadeIn : P.fadeOut);
      const EPS = 1e-4;
      const settled =
        !active &&
        Math.abs(this._sm.x - tx) < EPS &&
        Math.abs(this._sm.y - ty) < EPS &&
        this._hm < EPS;
      if (settled) {
        this._sm.x = tx;
        this._sm.y = ty;
        this._hm = 0;
      }
      if (this._hasRendered && this._carousel) {
        const dist = Math.abs((this._carousel._scrollProgress || 0) - this._slideIndex);
        if (dist >= 1) return settled;
      }
      if (glCanvas.width !== this._w || glCanvas.height !== this._h) {
        glCanvas.width = this._w;
        glCanvas.height = this._h;
        gl.viewport(0, 0, this._w, this._h);
      }
      let mouseX = this._sm.x;
      if (P.spotlightMode === "scroll" && this._carousel) {
        mouseX += (this._carousel._scrollProgress || 0) - this._slideIndex;
      }
      gl.uniform2f(uni.uMouse, mouseX, this._sm.y);
      gl.uniform2f(uni.uRes, this._w, this._h);
      gl.uniform1f(uni.uLightH, P.lightHeight);
      gl.uniform1f(uni.uStrength, P.shadowStrength);
      gl.uniform1f(uni.uSoft, P.shadowSoftness);
      gl.uniform1f(uni.uMinBri, P.minBrightness);
      gl.uniform1f(uni.uNorm, P.normalStrength);
      gl.uniform1f(uni.uPara, P.parallax);
      gl.uniform1f(uni.uAO, P.aoStrength);
      gl.uniform1f(uni.uHover, this._hm);
      gl.uniform1f(uni.uSpotR, P.spotRadius);
      gl.uniform1f(uni.uSpotFloor, P.spotFloor);
      gl.uniform1f(uni.uShadLen, P.shadowLength);
      gl.uniform1f(uni.uBoost, P.lightBoost);
      gl.uniform1f(uni.uHighlight, P.highlight);
      gl.uniform1f(uni.uSpotFalloff, P.spotFalloff);
      gl.uniform3f(uni.uSpotColor, ...hexToRgb(P.spotColor));
      gl.uniform2f(uni.uUvScale, this._cover.scaleX, this._cover.scaleY);
      gl.uniform2f(uni.uUvOffset, this._cover.offX, this._cover.offY);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._tex.img);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this._tex.dep);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this._ctx2d.drawImage(glCanvas, 0, 0);
      this._hasRendered = true;
      return settled;
    }
  }
  customElements.define("product-spotlight", ProductSpotlight);

  class SpotlightCarousel extends HTMLElement {
    _scrollProgress = 0;
    _items!: NodeListOf<Element>;
    _markers: HTMLElement[] = [];
    _current = 0;
    connectedCallback() {
      this._scrollProgress = 0;
      const items = this.querySelectorAll(":scope > ul > li");
      const nav = this.querySelector(':scope > [role="tablist"]');
      if (items.length < 2 || !nav) return;
      this._items = items;
      this._markers = [...nav.querySelectorAll('[role="tab"]')] as HTMLElement[];
      this._current = this._markers.findIndex(
        (m) => m.getAttribute("aria-selected") === "true",
      );
      if (this._current < 0) this._current = 0;
      this._markers.forEach((btn, i) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          this._goTo(i);
        });
      });
      nav.addEventListener("keydown", (e: any) => {
        let next: number | undefined;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          next = (this._current + 1) % this._markers.length;
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          next = (this._current - 1 + this._markers.length) % this._markers.length;
        } else if (e.key === "Home") {
          next = 0;
        } else if (e.key === "End") {
          next = this._markers.length - 1;
        }
        if (next != null) {
          e.preventDefault();
          this._goTo(next);
          this._markers[next].focus();
        }
      });
      const scroller = this.querySelector(":scope > ul");
      if (scroller) {
        let ticking = false;
        scroller.addEventListener("scroll", () => {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            ticking = false;
            const slideWidth = (scroller as HTMLElement).offsetWidth;
            if (slideWidth === 0) return;
            this._scrollProgress = scroller.scrollLeft / slideWidth;
            const idx = Math.round(this._scrollProgress);
            if (idx !== this._current && idx >= 0 && idx < this._markers.length) {
              this._setActive(idx);
            }
          });
        });
      }
    }
    _goTo(idx: number) {
      const li = this._items[idx];
      if (!li) return;
      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      li.scrollIntoView({
        behavior: reducedMotion ? "instant" : "smooth",
        block: "nearest",
        inline: "center",
      } as ScrollIntoViewOptions);
      this._setActive(idx);
    }
    _setActive(idx: number) {
      this._markers[this._current]?.setAttribute("aria-selected", "false");
      this._markers[this._current]?.setAttribute("tabindex", "-1");
      this._current = idx;
      this._markers[idx]?.setAttribute("aria-selected", "true");
      this._markers[idx]?.setAttribute("tabindex", "0");
    }
  }
  customElements.define("spotlight-carousel", SpotlightCarousel);
}

export const ShopSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    registerShopElements();
    // card click delegation — clicking a card triggers its own chevron link
    const section = sectionRef.current;
    if (!section) return;
    const cards = Array.from(section.querySelectorAll(".card"));
    const handlers = cards.map((card) => {
      const onClick = (e: Event) => {
        if ((e.target as Element).closest('a, [role="tablist"]')) return;
        (card.querySelector("a") as HTMLAnchorElement | null)?.click();
      };
      card.addEventListener("click", onClick);
      return { card, onClick };
    });
    return () =>
      handlers.forEach(({ card, onClick }) =>
        card.removeEventListener("click", onClick),
      );
  }, []);

  return (
    <section className="shop-section" aria-label="Shop" ref={sectionRef}>
      <style>{css}</style>

      <div className="shop-wrap">
        <div
          className="shop-stage"
          dangerouslySetInnerHTML={{ __html: cardHtml(PRODUCTS[0]) }}
        />
        <div className="shop-copy">
          <p className="kicker">Featured</p>
          <h1>Packs</h1>
          <p>
            Demo description — 24 curated item packs in one collection.
            Bundles of gear, boosts, and cosmetics assembled for every play
            style. Hover the card to sweep the light across the product, then
            hit the arrow to browse the full collection.
          </p>
        </div>
      </div>

      <div className="shop-wrap">
        <div
          className="shop-stage"
          dangerouslySetInnerHTML={{ __html: cardHtml(PRODUCTS[1]) }}
        />
        <div className="shop-copy">
          <p className="kicker">New</p>
          <h1>Caps</h1>
          <p>
            Demo description — 12 performance caps built for the grind.
            Water-resistant shells, laser-perforated venting, and a fit that
            stays put from first rep to last mile. Hover the card to sweep the
            light across the product, then hit the arrow to see them all.
          </p>
        </div>
      </div>
    </section>
  );
};
