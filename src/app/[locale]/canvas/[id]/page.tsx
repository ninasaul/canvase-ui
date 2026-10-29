import { notFound, redirect } from "next/navigation";
import { CanvasEditor } from "@/components/canvas/canvas-editor";
import { hasLocale } from "@/i18n/get-dictionary";
import { withLocale } from "@/lib/i18n-path";
import { getSession } from "@/lib/session";

type CanvasPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function CanvasPage({ params }: CanvasPageProps) {
  const { locale, id } = await params;
  if (!hasLocale(locale)) {
    notFound();
  }

  const session = await getSession();
  if (!session?.user) {
    redirect(withLocale(locale, "/login"));
  }

  return <CanvasEditor key={id} canvasId={id} />;
}
