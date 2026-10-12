import Link from "next/link";
import { Logo } from "@/components/Logo";

const navLinks = [
  { href: "/#platform", label: "Platform" },
  { href: "/#solutions", label: "Solutions" },
  { href: "/integrations", label: "Integrations" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#company", label: "Company" },
];

const legalLinks = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/integrations/policy", label: "Ingestion policy" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <nav aria-label="Primary" className="container site-nav">
        <Logo />
        <div className="site-nav-links">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
          <Link href="/#demo" className="btn btn-primary">
            Request a Demo
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer id="company" className="site-footer">
      <div className="container site-footer-inner">
        <div>
          <Logo markSize={28} fontSize={18} />
          <span className="site-footer-tagline">OPERATE. OPTIMIZE. OUTPERFORM.</span>
        </div>
        <div className="site-footer-links">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </div>
        <span>© 2026 StratosOpx. All rights reserved.</span>
      </div>
      <nav aria-label="Legal" className="container site-footer-legal">
        {legalLinks.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
