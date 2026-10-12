const X0 = 36;
const X1 = 404;
const BASE = 140;

export function VolumeChart({ values, month }: { values: number[]; month: string }) {
  if (values.length < 2) values = [...values, ...Array(2 - values.length).fill(0)];
  const n = values.length;
  // Scale to the data with ~20% headroom, in steps of 10.
  const max = Math.max(10, Math.ceil((Math.max(...values) * 1.2) / 10) * 10);
  const pts = values.map((v, i) => [X0 + ((X1 - X0) * i) / (n - 1), BASE - (v / max) * 120] as const);

  let line = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const mx = ((px + cx) / 2).toFixed(1);
    line += ` C${mx} ${py.toFixed(1)},${mx} ${cy.toFixed(1)},${cx.toFixed(1)} ${cy.toFixed(1)}`;
  }
  const area = `${line} L${X1} ${BASE} L${X0} ${BASE} Z`;

  const peak = values.indexOf(Math.max(...values));
  const [peakX, peakY] = pts[peak];
  const total = values.reduce((a, b) => a + b, 0);
  const tipX = Math.min(Math.max(peakX - 29, 30), X1 - 58);
  const ticks = [0, 7, 14, 21, 28].filter((d) => d < n);

  return (
    <>
      <div className="volume-total">
        <strong>{total.toLocaleString("en-US")} POs</strong>
        <span className="kpi-note">Received this month, excluding rejected</span>
      </div>
      <svg
        className="volume-svg"
        viewBox="0 0 420 170"
        role="img"
        aria-label={`Daily purchase orders processed in ${month}, peaking at ${values[peak]} on ${month} ${peak + 1}`}
      >
        <defs>
          <linearGradient id="vc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6366F1" stopOpacity="0.55" />
            <stop offset="1" stopColor="#6366F1" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="vc-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#818CF8" stopOpacity="0.7" />
            <stop offset="1" stopColor="#2563EB" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <g stroke="rgba(148,163,184,0.12)">
          {[20, 80, 140].map((y) => (
            <line key={y} x1={30} y1={y} x2={410} y2={y} />
          ))}
        </g>
        <g fontSize="10" fill="#94A3B8" textAnchor="end">
          <text x={24} y={24}>
            {max}
          </text>
          <text x={24} y={84}>
            {max / 2}
          </text>
          <text x={24} y={144}>
            0
          </text>
        </g>
        {pts.map(([x, y], i) => (
          <rect key={i} x={x - 2.5} y={y + 6} width={5} height={Math.max(0, BASE - y - 6)} rx={1.5} fill="url(#vc-bar)" />
        ))}
        <path d={area} fill="url(#vc-area)" />
        <path d={line} fill="none" stroke="#A5B4FC" strokeWidth="2" />
        <line x1={peakX} y1={peakY} x2={peakX} y2={BASE} stroke="#A5B4FC" strokeDasharray="3 3" />
        <circle cx={peakX} cy={peakY} r={4.5} fill="#E0E7FF" />
        <rect x={tipX} y={2} width={58} height={34} rx={6} fill="#1E1B4B" stroke="#6366F1" />
        <text x={tipX + 29} y={15} textAnchor="middle" fontSize="9" fill="#C7D2FE">
          {month} {peak + 1}
        </text>
        <text x={tipX + 29} y={29} textAnchor="middle" fontSize="12" fontWeight="600" fill="#fff">
          {values[peak]} POs
        </text>
        <g fontSize="10" fill="#94A3B8" textAnchor="middle">
          {ticks.map((d) => (
            <text key={d} x={pts[d][0]} y={162}>
              {month} {d + 1}
            </text>
          ))}
        </g>
      </svg>
    </>
  );
}
