import { Link } from "react-router";

export function ErpSync() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>ERP sync</h1>
          <p>The ERP connection StratosOpx reads from and writes approved orders to.</p>
        </div>
      </div>

      <section className="card" aria-labelledby="conn-title" style={{ maxWidth: 640 }}>
        <div className="card-head">
          <h2 id="conn-title">Connection</h2>
          <span className="pill tone-info">Sandbox</span>
        </div>
        <dl className="meta-list">
          <dt>ERP</dt>
          <dd>Mock ERP</dd>
          <dt>Payload format</dt>
          <dd>NetSuite sales order</dd>
          <dt>Writes</dt>
          <dd>Stored for inspection; nothing leaves StratosOpx</dd>
        </dl>
        <p className="hint" style={{ marginBottom: 0 }}>
          A real ERP connection replaces this once a design partner provides sandbox access. Inbound documents are on the{" "}
          <Link to="/intake">Intake</Link> page.
        </p>
      </section>
    </>
  );
}
