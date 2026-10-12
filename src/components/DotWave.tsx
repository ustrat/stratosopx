type Density = "low" | "medium" | "high";

const grid: Record<Density, [cols: number, rows: number]> = {
  low: [44, 16],
  medium: [64, 22],
  high: [84, 30],
};

function buildDots(density: Density) {
  const [cols, rows] = grid[density];
  const dots: { x: number; y: number; r: number; o: number }[] = [];
  for (let v = 0; v < rows; v++) {
    const z = v / (rows - 1);
    const scale = 1 / (1 + z * 1.6);
    for (let u = 0; u < cols; u++) {
      const X = (u / (cols - 1) - 0.5) * 2.4;
      const h = 0.32 * Math.sin(X * 2.6 + z * 4.2) + 0.16 * Math.cos(X * 4.4 - z * 2.5);
      dots.push({
        x: +(600 + X * 620 * scale).toFixed(1),
        y: +(470 - z * 300 - h * 210 * scale).toFixed(1),
        r: +(2.6 * scale).toFixed(2),
        o: +(0.18 + 0.82 * scale * scale).toFixed(2),
      });
    }
  }
  return dots;
}

export function DotWave({ density = "medium", className }: { density?: Density; className?: string }) {
  const dots = buildDots(density);
  return (
    <svg
      className={className}
      viewBox="0 0 1200 520"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dotwave-gradient" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="0.55" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} opacity={d.o} fill="url(#dotwave-gradient)" />
      ))}
    </svg>
  );
}
