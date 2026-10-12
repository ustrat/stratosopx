import type { Metadata } from "next";
import Link from "next/link";
import { ExecutionProvider, KillSwitch } from "@/components/dashboard/ExecutionProvider";
import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Command Center · StratosOpx",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <ExecutionProvider>
      <div className="app">
        <aside className="sidebar">
          <Logo href="/dashboard" markSize={30} fontSize={19} />
          <SidebarNav />

          <div className="sidebar-footer">
            <div className="side-card">
              <div className="side-card-title">
                ERP connection <span className="status-dot" />
              </div>
              <div style={{ color: "#6EE7B7" }}>NetSuite · SuiteTalk REST</div>
              <div className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>
                Last write 2 min ago
              </div>
              <Link href="/dashboard/erp-sync">View sync log →</Link>
            </div>
            <div className="side-card side-card-promo">
              <div className="side-card-title">Proof of Accuracy Audit</div>
              <div>
                Send 5 of your messiest POs or your last RFP and see the structured result for each, before anything
                touches your ERP.
              </div>
              <Link href="/dashboard/orders">Start an audit →</Link>
            </div>
          </div>
        </aside>

        <div className="app-main">
          <div className="topbar">
            <form role="search" className="search" action="/dashboard/orders">
              <Icon name="search" size={16} strokeWidth={2} />
              <label htmlFor="global-search" className="sr-only">
                Search
              </label>
              <input id="global-search" name="q" type="search" placeholder="Search POs, SKUs, customers, RFPs…" />
              <span className="kbd mono">⌘K</span>
            </form>
            <div className="topbar-user">
              <KillSwitch compact />
              <button type="button" className="icon-btn" aria-label="Notifications">
                <Icon name="bell" />
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="avatar" aria-hidden="true">
                  OA
                </div>
                <div className="user-meta">
                  [Your name]
                  <small>Operations Admin</small>
                </div>
              </div>
            </div>
          </div>

          <main id="main" className="app-content">
            {children}
          </main>
        </div>
      </div>
    </ExecutionProvider>
  );
}
