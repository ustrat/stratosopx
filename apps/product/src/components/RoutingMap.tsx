
const stages = [
  { x: 70, label: "Intake" },
  { x: 215, label: "Extract" },
  { x: 360, label: "SKU match" },
  { x: 505, label: "Verify" },
];

const primary = "M70 80 C140 68,145 96,215 86 C285 76,290 70,360 80 C430 92,435 74,505 80 C590 86,620 122,690 130";
const secondary = "M70 150 C140 140,145 166,215 155 C285 144,290 162,360 150 C430 138,435 160,505 150 C590 144,620 136,690 130";
const exception = "M70 215 C140 204,145 226,215 215 C285 204,290 226,360 215 C430 206,470 246,505 250";

const nodes = [
  { cy: [80, 86, 80, 80], fill: "#EDE9FE" },
  { cy: [150, 155, 150, 150], fill: "#DBEAFE" },
  { cy: [215, 215, 215], fill: "#CCFBF1" },
];


type Split = { clean: number; change: number; exception: number; total: number };

export function RoutingMap({ split }: { split: Split }) {
  const routingSplit = [
    { label: "Clean PO", share: split.clean, color: "#A78BFA" },
    { label: "Change order", share: split.change, color: "#60A5FA" },
    { label: "Exception → review", share: split.exception, color: "#2DD4BF" },
  ];
  const [clean, change, review] = routingSplit;
  return (
    <section aria-labelledby="routing-title" className="card col-wide">
      <div className="card-head">
        <h2 id="routing-title">Order routing map</h2>
        <span className="muted-label">{split.total.toLocaleString("en-US")} orders this month</span>
      </div>

      <svg
        className="routing-svg"
        viewBox="0 0 780 300"
        role="img"
        aria-label={`Order routing: ${clean.share}% clean, ${change.share}% change orders, ${review.share}% routed to human review`}
      >
        <defs>
          <linearGradient id="rm-pill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#A78BFA" />
            <stop offset="0.5" stopColor="#3B82F6" />
            <stop offset="1" stopColor="#2DD4BF" />
          </linearGradient>
          <filter id="rm-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <radialGradient id="rm-ok">
            <stop offset="0" stopColor="#6366F1" stopOpacity="0.6" />
            <stop offset="1" stopColor="#6366F1" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g fontFamily="var(--font-inter)" fontSize="13" fill="#E2E8F0" textAnchor="middle">
          {stages.map((s) => (
            <text key={s.label} x={s.x} y={22}>
              {s.label}
            </text>
          ))}
          <text x={690} y={22}>
            ERP write
          </text>
        </g>

        <g fill="none" strokeLinecap="round" opacity="0.35" filter="url(#rm-glow)">
          <path d={primary} stroke="#8B5CF6" strokeWidth="16" />
          <path d={secondary} stroke="#3B82F6" strokeWidth="12" />
          <path d={exception} stroke="#2DD4BF" strokeWidth="10" />
        </g>

        <g fill="none" strokeLinecap="round">
          <path d={primary} stroke="#A78BFA" strokeWidth="3" />
          <path d={primary} stroke="#8B5CF6" strokeWidth="1" opacity="0.6" transform="translate(0 -8)" />
          <path d={primary} stroke="#8B5CF6" strokeWidth="1" opacity="0.6" transform="translate(0 8)" />
          <path d={secondary} stroke="#60A5FA" strokeWidth="2.5" />
          <path d={secondary} stroke="#3B82F6" strokeWidth="1" opacity="0.6" transform="translate(0 7)" />
          <path d={exception} stroke="#2DD4BF" strokeWidth="2.5" />
          <path d="M505 250 C590 246,620 160,690 130" stroke="#2DD4BF" strokeWidth="2" strokeDasharray="4 6" />
        </g>

        {stages.map((s, i) => {
          const h = i === 3 ? 186 : 196;
          return (
            <g key={s.label}>
              <rect x={s.x - 8} y={44} width={16} height={h + 4} rx={8} fill="url(#rm-pill)" opacity="0.25" filter="url(#rm-glow)" />
              <rect x={s.x - 6} y={46} width={12} height={h} rx={6} fill="none" stroke="url(#rm-pill)" strokeWidth="2.5" />
            </g>
          );
        })}

        {nodes.map((row) =>
          row.cy.map((cy, i) => <circle key={`${row.fill}-${i}`} cx={stages[i].x} cy={cy} r={5} fill={row.fill} />),
        )}

        <circle cx={505} cy={250} r={16} fill="#0A0F1E" stroke="#FBBF24" strokeWidth="2" />
        <text x={505} y={255} textAnchor="middle" fontSize="15" fontWeight="700" fill="#FBBF24">
          !
        </text>
        <text x={505} y={286} textAnchor="middle" fontSize="12" fill="#E2E8F0">
          Human review
        </text>

        <circle cx={690} cy={130} r={38} fill="url(#rm-ok)" />
        <circle cx={690} cy={130} r={20} fill="#0A0F1E" stroke="#A5B4FC" strokeWidth="2.5" />
        <path d="M681 130l6 6 12-12" fill="none" stroke="#E0E7FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      </svg>

      <div className="legend">
        {routingSplit.map((r) => (
          <span key={r.label} className="legend-item">
            <span className="legend-swatch" style={{ background: r.color }} />
            {r.label} <span style={{ color: "var(--text-faint)" }}>{r.share}%</span>
          </span>
        ))}
      </div>
    </section>
  );
}
