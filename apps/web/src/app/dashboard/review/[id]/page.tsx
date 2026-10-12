import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BidReviewer } from "@/components/review/BidReviewer";
import { OrderReviewer } from "@/components/review/OrderReviewer";
import { getReview, reviews } from "@/lib/review";

export const dynamicParams = false;

export function generateStaticParams() {
  return reviews.map((r) => ({ id: r.id }));
}

export async function generateMetadata(props: PageProps<"/dashboard/review/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const review = getReview(id);
  return { title: review ? `${review.title} · Review · StratosOpx` : "Review · StratosOpx" };
}

const kindLabel = { po: "Purchase order", "change-order": "Change order", rfp: "RFP" } as const;

export default async function ReviewPage(props: PageProps<"/dashboard/review/[id]">) {
  const { id } = await props.params;
  const review = getReview(id);
  if (!review) notFound();

  return (
    <>
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/dashboard/review">Review queue</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className={review.kind === "rfp" ? undefined : "mono"}>
          {review.title}
        </span>
      </nav>

      <div className="page-head">
        <div>
          <span className="eyebrow-sm">{kindLabel[review.kind]}</span>
          <h1 className={review.kind === "rfp" ? undefined : "mono-title"}>{review.title}</h1>
          {review.kind === "rfp" ? (
            <p>
              {review.owner} · received {review.receivedAt}
            </p>
          ) : (
            <p>
              {review.customer.name} <span className="mono">({review.customer.id})</span> ·{" "}
              <span className="mono">{review.sourceFile}</span> via {review.channel} · {review.receivedAt}
              {review.salesOrder && (
                <>
                  {" "}
                  · updates <span className="mono">{review.salesOrder}</span>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {review.kind === "rfp" ? <BidReviewer bid={review} /> : <OrderReviewer order={review} />}
    </>
  );
}
