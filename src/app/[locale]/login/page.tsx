import { notFound, redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { hasLocale } from "@/i18n/get-dictionary";
import { withLocale } from "@/lib/i18n-path";
import { getMessages } from "@/messages";
import { getSession } from "@/lib/session";
import { tenantSignInRedirectPath } from "@/lib/tenant-login-redirect";

type LoginPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; reason?: string }>;
};

export default async function LoginPage({
  params,
  searchParams,
}: LoginPageProps) {
  const { locale } = await params;
  if (!hasLocale(locale)) {
    notFound();
  }

  const query = await searchParams;
  const nextPath = query.next
    ? tenantSignInRedirectPath(query.next, locale)
    : undefined;

  const session = await getSession();
  if (session?.user) {
    redirect(withLocale(locale, nextPath ?? "/canvas"));
  }

  const messages = getMessages(locale);
  const notice =
    query.reason === "session-expired"
      ? messages.auth.sessionExpired
      : undefined;

  return (
    <AuthShell>
      <AuthForm mode="sign-in" next={nextPath} notice={notice} />
    </AuthShell>
  );
}
