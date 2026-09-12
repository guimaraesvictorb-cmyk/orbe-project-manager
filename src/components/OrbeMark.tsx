import { useId, useMemo } from "react";

// Símbolo da marca ORBE — núcleo + duas órbitas assimétricas + 3 satélites,
// construído a partir das proporções do Manual da Marca (v1.0, 2026):
// núcleo 0.58x, órbita interna 1.00x, órbita externa 1.52x, espessura 0.163x.
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

const CX = 32, CY = 32;
const X = 18; // raio da órbita interna
const CORE_R = X * 0.58;
const INNER_R = X;
const OUTER_R = X * 1.52;
const STROKE = X * 0.163;

const INNER_GAP_START = 320, INNER_GAP_END = 60; // gap ~100° no topo, leve deslocamento à direita
const OUTER_GAP_START = 140, OUTER_GAP_END = 240; // gap ~100° embaixo-esquerda (assimetria)

const innerArcD = describeArc(CX, CY, INNER_R, INNER_GAP_END, INNER_GAP_START);
const outerArcD = describeArc(CX, CY, OUTER_R, OUTER_GAP_END, 360 + OUTER_GAP_START);

const satMaior = polarToCartesian(CX, CY, OUTER_R, OUTER_GAP_START);
const satMedio = polarToCartesian(CX, CY, INNER_R, INNER_GAP_END);
const satMenor = polarToCartesian(CX, CY, X * 1.26, 5);

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function OrbeMark({ size = 24, className, animated = false, glow = false }: { size?: number; className?: string; animated?: boolean; glow?: boolean }) {
  const reactId = useId();
  const gradId = `orbe-core-grad-${reactId}`;
  const glowId = `orbe-glow-${reactId}`;
  const spin = useMemo(() => animated && !prefersReducedMotion(), [animated]);

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#123B52" />
          <stop offset="100%" stopColor="#062A3C" />
        </radialGradient>
        {glow && (
          <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      <g filter={glow ? `url(#${glowId})` : undefined}>
        <g>
          <path d={innerArcD} stroke="#0085C2" strokeWidth={STROKE} strokeLinecap="round" fill="none" />
          <circle cx={satMedio.x} cy={satMedio.y} r={X * 0.173} fill="#0085C2" />
          {spin && <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="26s" repeatCount="indefinite" />}
        </g>
        <g>
          <path d={outerArcD} stroke="#4FC3E8" strokeWidth={STROKE} strokeLinecap="round" fill="none" />
          <circle cx={satMaior.x} cy={satMaior.y} r={X * 0.25} fill="#4FC3E8" />
          {spin && <animateTransform attributeName="transform" type="rotate" from="360 32 32" to="0 32 32" dur="38s" repeatCount="indefinite" />}
        </g>
        <circle cx={satMenor.x} cy={satMenor.y} r={X * 0.091} fill="#4FC3E8" />
        <circle cx={CX} cy={CY} r={CORE_R} fill={`url(#${gradId})`} />
      </g>
    </svg>
  );
}
