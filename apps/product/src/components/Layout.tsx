import { NavLink, Outlet } from "react-router";
import { useApi } from "../api";
import type { Branding, Me } from "../types";
import { KillSwitch } from "./Controls";
import { Icon, type IconName } from "./Icon";
import { Logo } from "./Logo";

const nav: { to: string; label: string; icon: IconName; end?: boolean; adminOnly?: boolean; platformOnly?: boolean }[] = [
  { to: "/", label: "Overview", icon: "overview", end: true },
  { to: "/intake", label: "Intake", icon: "inbox" },
  { to: "/review", label: "Review queue", icon: "shield" },
  { to: "/orders", label: "Orders", icon: "document" },
  { to: "/bids", label: "Bids & RFPs", icon: "building" },
  { to: "/catalog", label: "Catalog", icon: "layers" },
  { to: "/erp-sync", label: "ERP sync", icon: "database" },
  { to: "/settings", label: "Settings & controls", icon: "settings" },
  { to: "/audit", label: "Audit log", icon: "pulse", adminOnly: true },
  { to: "/platform", label: "Companies", icon: "building", platformOnly: true },
];

export function Layout() {
  const { data: me, error } = useApi<Me>("/me");
  const { data: brand } = useApi<Branding>(me ? "/branding" : null);

  if (error) {
    return (
      <main id="main" className="app-main" style={{ maxWidth: 640, margin: "80px auto" }}>
        <div className="card placeholder">
          <h2>{error.status === 403 ? "You don't have access yet" : "Can't load StratosOpx"}</h2>
          <p>{error.message}</p>
          <a className="btn btn-ghost" href="/cdn-cgi/access/logout">
            Sign out
          </a>
        </div>
      </main>
    );
  }

  const initials = (me?.user.name ?? me?.user.email ?? "?")
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Logo />
        <nav aria-label="Main" className="sidebar-nav">
          {nav
            .filter((n) => (!n.adminOnly || me?.user.role === "admin") && (!n.platformOnly || me?.isPlatformAdmin))
            .map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="sidebar-link">
                <Icon name={n.icon} />
                {n.label}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-footer">
          <div className="side-card">
            <div className="side-card-title">{me?.tenant.name ?? " "}</div>
            <div style={{ color: "var(--text-faint)" }}>ERP: Mock ERP · sandbox</div>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <div className="topbar">
          <span className="topbar-company">
            {brand?.logoUrl && <img src={brand.logoUrl} alt="" className="topbar-logo" />}
            <span>{me?.tenant.name ?? ""}</span>
          </span>
          <div className="topbar-user">
            <KillSwitch compact />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="avatar" aria-hidden="true">
                {initials}
              </div>
              <div className="user-meta">
                {me?.user.name ?? me?.user.email ?? "…"}
                <small>
                  {me?.user.role} · <a href="/cdn-cgi/access/logout">Sign out</a>
                </small>
              </div>
            </div>
          </div>
        </div>
        <main id="main" className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
