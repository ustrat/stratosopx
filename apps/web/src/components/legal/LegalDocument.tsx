import type { ReactNode } from "react";

type Segment = { text: string; bold: boolean };

type Block =
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "paragraph"; segments: Segment[] }
  | { type: "list"; items: Segment[][] }
  | { type: "table"; header: string[]; rows: string[][] };

export type LegalDoc = {
  title: string | null;
  preamble: string[];
  blocks: Block[];
  source: string;
};

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// Highlights [placeholders] still to be filled in and links email addresses.
function rich(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\[[^\]]+\]|[a-z]+@stratosopx\.com)/g).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^\[[^\]]+\]$/.test(part)) {
      return (
        <mark key={key} className="placeholder-mark" title="Placeholder to confirm before publication">
          {part}
        </mark>
      );
    }
    if (/^[a-z]+@stratosopx\.com$/.test(part)) {
      return (
        <a key={key} href={`mailto:${part}`}>
          {part}
        </a>
      );
    }
    return part;
  });
}

function Segments({ segments, id }: { segments: Segment[]; id: string }) {
  return (
    <>
      {segments.map((s, i) =>
        s.bold ? <strong key={i}>{rich(s.text, `${id}-${i}`)}</strong> : <span key={i}>{rich(s.text, `${id}-${i}`)}</span>,
      )}
    </>
  );
}

export function LegalDocument({ doc }: { doc: LegalDoc }) {
  const [dateLine, ...notes] = doc.preamble;
  const updated = dateLine?.split("·")[0].trim();
  const headings = doc.blocks.filter((b): b is Extract<Block, { type: "heading" }> => b.type === "heading");
  const hasPlaceholders = JSON.stringify(doc.blocks).includes("[");

  return (
    <main id="main" className="pricing">
      <section className="container pricing-hero">
        <span className="eyebrow">LEGAL</span>
        <h1>{doc.title?.replace(/^StratosOpX\s+/, "")}</h1>
        {updated && <p className="hint" style={{ margin: 0 }}>Last updated {updated}</p>}
        <div className="draft-banner" role="note">
          <strong>Draft, pending counsel review.</strong> {notes.join(" ")}
          {hasPlaceholders && (
            <>
              {" "}
              Highlighted <mark className="placeholder-mark">[items]</mark> are placeholders.
            </>
          )}
        </div>
      </section>

      <div className="container policy-layout">
        <nav aria-label="Sections" className="policy-toc">
          {headings.map((h) => (
            <a key={h.text} href={`#${slug(h.text)}`}>
              {h.text}
            </a>
          ))}
        </nav>

        <div className="policy-body legal-body">
          {doc.blocks.map((b, i) => {
            const id = `b${i}`;
            switch (b.type) {
              case "heading":
                return (
                  <h2 key={id} id={slug(b.text)}>
                    {b.text}
                  </h2>
                );
              case "subheading":
                return <h3 key={id}>{rich(b.text, id)}</h3>;
              case "paragraph":
                return (
                  <p key={id}>
                    <Segments segments={b.segments} id={id} />
                  </p>
                );
              case "list":
                return (
                  <ul key={id}>
                    {b.items.map((item, j) => (
                      <li key={j}>
                        <Segments segments={item} id={`${id}-${j}`} />
                      </li>
                    ))}
                  </ul>
                );
              case "table":
                return (
                  <div key={id} className="card table-wrap legal-table">
                    <table className="table">
                      <thead>
                        <tr>
                          {b.header.map((h) => (
                            <th key={h} scope="col">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {b.rows.map((row, r) => (
                          <tr key={r}>
                            {row.map((cell, c) =>
                              c === 0 ? (
                                <th key={c} scope="row">
                                  {rich(cell, `${id}-${r}-${c}`)}
                                </th>
                              ) : (
                                <td key={c}>{rich(cell, `${id}-${r}-${c}`)}</td>
                              ),
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
            }
          })}
        </div>
      </div>
    </main>
  );
}
