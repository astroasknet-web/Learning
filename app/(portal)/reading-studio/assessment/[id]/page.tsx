import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PortalPage } from "@/components/portal/shell";
import AssessmentRunner from "@/components/reading/AssessmentRunner";
import { studentPage } from "@/lib/reading/page";
import { getAssessment, runnerState } from "@/lib/reading/store";
import { KIND_LABEL } from "@/lib/reading/taxonomy";

export const metadata: Metadata = { title: "Reading assessment | English Reading Studio | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me, csrf } = await studentPage(`/reading-studio/assessment/${id}`);
  const a = await getAssessment(me.id, id);
  if (!a) notFound();
  if (a.status === "submitted") redirect(`/reading-studio/results/${id}`);
  const state = await runnerState(me.id, id);
  if (!state) notFound();
  return (
    <PortalPage user={me} active="reading-studio" title={KIND_LABEL[a.kind]} wide="full">
      <AssessmentRunner state={state} csrf={csrf} title={KIND_LABEL[a.kind]} />
    </PortalPage>
  );
}
