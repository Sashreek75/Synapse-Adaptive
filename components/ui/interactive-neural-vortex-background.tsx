"use client";

/**
 * INTERACTIVE NEURAL VORTEX — a full-screen WebGL "neuro" field that reacts to the pointer and to
 * scroll. Recolored to the Synapse palette: deep navy filaments with molten-orange hot cores over
 * black. Content-agnostic: it renders only the canvas, meant to sit fixed behind the whole app.
 * Respects prefers-reduced-motion (draws a single still frame instead of animating).
 *
 * Adapted from an original purple/cyan shader; VR demo hero copy removed for Synapse.
 */

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function InteractiveNeuralVortex({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointer = useRef({ x: 0, y: 0, tX: 0, tY: 0 });
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const gl =
      (canvasEl.getContext("webgl") as WebGLRenderingContext | null) ||
      (canvasEl.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    const vsSource = `
      precision mediump float;
      attribute vec2 a_position;
      varying vec2 vUv;
      void main() {
        vUv = .5 * (a_position + 1.);
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Synapse recolor: navy base, orange hot cores, a slow scroll-driven blue shimmer.
    const fsSource = `
      precision mediump float;
      varying vec2 vUv;
      uniform float u_time;
      uniform float u_ratio;
      uniform vec2 u_pointer_position;
      uniform float u_scroll_progress;

      vec2 rotate(vec2 uv, float th) {
        return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
      }

      float neuro_shape(vec2 uv, float t, float p) {
        vec2 sine_acc = vec2(0.);
        vec2 res = vec2(0.);
        float scale = 8.;
        for (int j = 0; j < 15; j++) {
          uv = rotate(uv, 1.);
          sine_acc = rotate(sine_acc, 1.);
          vec2 layer = uv * scale + float(j) + sine_acc - t;
          sine_acc += sin(layer) + 2.4 * p;
          res += (.5 + .5 * cos(layer)) / scale;
          scale *= (1.2);
        }
        return res.x + res.y;
      }

      void main() {
        vec2 uv = .5 * vUv;
        uv.x *= u_ratio;
        vec2 pointer = vUv - u_pointer_position;
        pointer.x *= u_ratio;
        float p = clamp(length(pointer), 0., 1.);
        p = .5 * pow(1. - p, 2.);
        float t = .001 * u_time;

        float noise = neuro_shape(uv, t, p);
        noise = 1.2 * pow(noise, 3.);
        noise += pow(noise, 10.);
        noise = max(.0, noise - .5);
        noise *= (1. - length(vUv - .5));

        // Deep navy filaments -> molten orange hot cores.
        vec3 navy   = vec3(0.09, 0.19, 0.42);
        vec3 orange = vec3(1.00, 0.44, 0.11);
        vec3 color = mix(navy, orange, clamp(pow(noise, 1.4) * 0.95, 0.0, 1.0));
        // A slow blue shimmer tied to scroll so the field feels alive as you move down the page.
        color = mix(color, vec3(0.15, 0.33, 0.66), 0.14 + 0.12 * sin(2.0 * u_scroll_progress + 1.2));
        color *= noise;

        gl_FragColor = vec4(color, noise);
      }
    `;

    const compileShader = (glCtx: WebGLRenderingContext, source: string, type: number) => {
      const shader = glCtx.createShader(type);
      if (!shader) return null;
      glCtx.shaderSource(shader, source);
      glCtx.compileShader(shader);
      if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
        console.error("Shader error:", glCtx.getShaderInfoLog(shader));
        glCtx.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(gl, vsSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uRatio = gl.getUniformLocation(program, "u_ratio");
    const uPointerPosition = gl.getUniformLocation(program, "u_pointer_position");
    const uScrollProgress = gl.getUniformLocation(program, "u_scroll_progress");

    // Perf: this is a soft, blurred ambient field, so it does not need full device resolution.
    // Rendering the shader at ~0.6x (capped) cuts per-frame GPU work by ~3x with no visible change.
    const RENDER_SCALE = 0.6;
    const resizeCanvas = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * RENDER_SCALE;
      canvasEl.width = Math.max(1, Math.round(window.innerWidth * scale));
      canvasEl.height = Math.max(1, Math.round(window.innerHeight * scale));
      gl.viewport(0, 0, canvasEl.width, canvasEl.height);
      gl.uniform1f(uRatio, canvasEl.width / canvasEl.height);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const drawFrame = () => {
      const currentTime = performance.now();
      gl.uniform1f(uTime, currentTime);
      gl.uniform2f(
        uPointerPosition,
        pointer.current.x / window.innerWidth,
        1 - pointer.current.y / window.innerHeight,
      );
      gl.uniform1f(uScrollProgress, window.pageYOffset / (2 * window.innerHeight));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Perf: cap to ~30fps (an ambient field doesn't need 60), and stop entirely when the tab is
    // hidden so Synapse never hogs the GPU while you're working in another tab.
    const FRAME_MS = 1000 / 30;
    let last = 0;
    let running = false;

    const render = (now: number) => {
      if (!running) return;
      animationRef.current = requestAnimationFrame(render);
      if (now - last < FRAME_MS) return;
      last = now;
      pointer.current.x += (pointer.current.tX - pointer.current.x) * 0.2;
      pointer.current.y += (pointer.current.tY - pointer.current.y) * 0.2;
      drawFrame();
    };

    const start = () => {
      if (running) return;
      running = true;
      last = 0;
      animationRef.current = requestAnimationFrame(render);
    };
    const stop = () => {
      running = false;
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
    const onVisibility = () => { if (document.hidden) stop(); else start(); };

    if (prefersReduced) {
      // Center the "pointer" and draw a single still frame — no perpetual motion.
      pointer.current.x = pointer.current.tX = window.innerWidth / 2;
      pointer.current.y = pointer.current.tY = window.innerHeight / 2;
      drawFrame();
    } else {
      if (!document.hidden) start();
      document.addEventListener("visibilitychange", onVisibility);
    }

    const handleMouseMove = (e: PointerEvent) => {
      pointer.current.tX = e.clientX;
      pointer.current.tY = e.clientY;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        pointer.current.tX = e.touches[0].clientX;
        pointer.current.tY = e.touches[0].clientY;
      }
    };
    window.addEventListener("pointermove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 -z-10 h-full w-full", className)}
    />
  );
}

export default InteractiveNeuralVortex;
