import { notFound, redirect } from "next/navigation";
import { CanvasList } from "@/components/canvas/canvas-list";
import { hasLocale } from "@/i18n/get-dictionary";
import { withLocale } from "@/lib/i18n-path";
import { getSession } from "@/lib/session";

type CanvasListPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CanvasListPage({ params }: CanvasListPageProps) {
  const { locale } = await params;
  if (!hasLocale(locale)) {
    notFound();
  }

  const session = await getSession();
  if (!session?.user) {
    redirect(withLocale(locale, "/login"));
  }

  return <CanvasList />;
}
