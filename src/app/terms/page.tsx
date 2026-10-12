import type { Metadata } from "next";
import doc from "@/content/legal/terms.json";
import { LegalDocument, type LegalDoc } from "@/components/legal/LegalDocument";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

export const metadata: Metadata = {
  title: "Terms of Service · StratosOpx",
  description: "The terms that govern use of the StratosOpX website, platform and AI agents.",
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <LegalDocument doc={doc as LegalDoc} />
      <SiteFooter />
    </>
  );
}
