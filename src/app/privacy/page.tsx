import type { Metadata } from "next";
import doc from "@/content/legal/privacy.json";
import { LegalDocument, type LegalDoc } from "@/components/legal/LegalDocument";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

export const metadata: Metadata = {
  title: "Privacy Policy · StratosOpx",
  description: "How StratosOpX collects, uses, shares and protects personal information.",
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <LegalDocument doc={doc as LegalDoc} />
      <SiteFooter />
    </>
  );
}
