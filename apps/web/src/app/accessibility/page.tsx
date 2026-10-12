import type { Metadata } from "next";
import doc from "@/content/legal/accessibility.json";
import { LegalDocument, type LegalDoc } from "@/components/legal/LegalDocument";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

export const metadata: Metadata = {
  title: "Accessibility Statement · StratosOpx",
  description: "StratosOpX's accessibility commitment, conformance status and how to get help.",
};

export default function AccessibilityPage() {
  return (
    <>
      <SiteHeader />
      <LegalDocument doc={doc as LegalDoc} />
      <SiteFooter />
    </>
  );
}
