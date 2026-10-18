"use client";

import { use, Suspense } from "react";
import { CustomerDetailPanel } from "@/components/customer-detail-panel";

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4 px-4 py-5 animate-in fade-in">
          <div className="h-8 w-36 bg-muted/40 animate-pulse rounded-lg" />
          <div className="h-32 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
          <div className="h-48 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
        </div>
      }
    >
      <CustomerDetailLoader params={params} />
    </Suspense>
  );
}

function CustomerDetailLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: customerId } = use(params);
  return (
    <main className="px-4 py-4 max-w-2xl mx-auto w-full">
      <CustomerDetailPanel customerId={customerId} showBackNav={true} />
    </main>
  );
}
