"use client";

import { useId } from "react";

/**
 * A real trend chart — area fill, soft gridlines, a dotted baseline, and the
 * latest point marked. Still "supporting evidence" (it lives beside a plain
 * reading), but substantial enough to feel like a dashboard, not a sparkline.
 */
export function TrendChart({
  values,
  baseline,
  positive = true,
  height = 132,
  width = 320,
}: {
  values: number[];
  baseline?: number;
  positive?: boolean;
  height?: number;
  width?: number;
}) {
  const gid = useId().replace(/[:]/g, "");
  if (!values || values.length < 2) {
    return <div className="grid h-[132px] place-items-center text-xs text-muted">Not enough check-ins yet to chart.</div>;
  }

  const padX = 10;
  const padY = 14;
  const min = Math.min(...values, baseline ?? Infinity);
  const max = Math.max(...values, baseline ?? -Infinity);
  const range = max - min || 1;
  const stepX = (width - padX * 2) / (values.length - 1);
  const yOf = (v: number) => padY + (1 - (v - min) / range) * (height - padY * 2);
  const pts = values.map((v, i) => [padX + i * stepX, yOf(v)] as const);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height - padY} L${pts[0][0].toFixed(1)},${height - padY} Z`;
  const stroke = positive ? "#16a34a" : "#f97316";
  const last = pts[pts.length - 1];
  const gridYs = [0.25, 0.5, 0.75].map((f) => padY + f * (height - padY * 2));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridYs.map((y, i) => (
        <line key={i} x1={padX} y1={y} x2={width - padX} y2={y} stroke="var(--line)" strokeWidth="1" />
      ))}
      {baseline != null && (
        <line x1={padX} y1={yOf(baseline)} x2={width - padX} y2={yOf(baseline)} stroke="var(--muted)" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
      )}
      <path d={area} fill={`url(#fill-${gid})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={stroke} />
      <circle cx={last[0]} cy={last[1]} r="6.5" fill={stroke} opacity="0.18" />
    </svg>
  );
}
