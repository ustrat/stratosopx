// ERP adapters. Every write goes through `ErpAdapter.writeSalesOrder`, called only
// by the execution service after approval checks pass.

export type ErpWrite = { endpoint: string; body: unknown };

export type WriteResult = { status: "created" | "duplicate"; idempotencyKey: string };

export interface ErpAdapter {
  readonly name: string;
  readonly environment: "sandbox" | "production";
  writeSalesOrder(orderId: string, write: ErpWrite, idempotencyKey: string): Promise<WriteResult>;
}

// Stands in for NetSuite / SAP B1 until a design partner provides sandbox access.
// It stores the exact payload a real ERP would receive.
export class MockErp implements ErpAdapter {
  readonly name = "Mock ERP";
  readonly environment = "sandbox" as const;

  constructor(
    private db: D1Database,
    private tenantId: string,
  ) {}

  async writeSalesOrder(orderId: string, write: ErpWrite, idempotencyKey: string): Promise<WriteResult> {
    const res = await this.db
      .prepare(
        `INSERT INTO erp_sales_orders (tenant_id, idempotency_key, order_id, endpoint, payload)
         VALUES (?, ?, ?, ?, ?) ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
      )
      .bind(this.tenantId, idempotencyKey, orderId, write.endpoint, JSON.stringify(write.body))
      .run();

    // Verify the resulting state, not just the call's success.
    const stored = await this.db
      .prepare("SELECT payload FROM erp_sales_orders WHERE tenant_id = ? AND idempotency_key = ?")
      .bind(this.tenantId, idempotencyKey)
      .first<{ payload: string }>();
    if (!stored || stored.payload !== JSON.stringify(write.body)) {
      throw new Error("ERP write could not be verified");
    }
    return { status: res.meta.changes > 0 ? "created" : "duplicate", idempotencyKey };
  }
}

export function erpFor(db: D1Database, tenant: { id: string; erp_connection: string }): ErpAdapter {
  switch (tenant.erp_connection) {
    case "mock":
      return new MockErp(db, tenant.id);
    default:
      throw new Error(`No ERP adapter for ${tenant.erp_connection}`);
  }
}
