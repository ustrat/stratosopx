export function Sparkline({ seed, color }: { seed: number; color: string }) {
  const points = Array.from({ length: 12 }, (_, i) => {
    const y = 11 + 6 * Math.sin(i * 1.3 + seed) + 3 * Math.sin(i * 2.7 + seed * 2);
    return `${(i * 5.6).toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg width="64" height="22" viewBox="0 0 64 22" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}
