import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sections } from "@/lib/sections";

export const dynamicParams = false;

export function generateStaticParams() {
  return sections.filter((s) => s.slug && !s.built).map((s) => ({ section: s.slug }));
}

export async function generateMetadata(props: PageProps<"/dashboard/[section]">): Promise<Metadata> {
  const { section } = await props.params;
  const match = sections.find((s) => s.slug === section);
  return { title: match ? `${match.label} · StratosOpx` : "StratosOpx" };
}

export default async function SectionPage(props: PageProps<"/dashboard/[section]">) {
  const { section } = await props.params;
  const match = sections.find((s) => s.slug === section && !s.built);
  if (!match) notFound();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{match.label}</h1>
          <p>{match.summary}</p>
        </div>
      </div>
      <div className="card placeholder">
        <h2>Not built yet</h2>
        <p>This view is part of the Command Center plan but has no screen yet. The Overview shows the live summary.</p>
        <Link href="/dashboard" className="btn btn-ghost">
          Back to Overview
        </Link>
      </div>
    </>
  );
}
