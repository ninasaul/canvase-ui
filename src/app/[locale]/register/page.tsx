import { notFound, redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { hasLocale } from "@/i18n/get-dictionary";
import { withLocale } from "@/lib/i18n-path";
import { getSession } from "@/lib/session";

type RegisterPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function RegisterPage({ params }: RegisterPageProps) {
  const { locale } = await params;
  if (!hasLocale(locale)) {
    notFound();
  }

  const session = await getSession();
  if (session?.user) {
    redirect(withLocale(locale, "/canvas"));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <AuthForm mode="sign-up" />
    </main>
  );
}
