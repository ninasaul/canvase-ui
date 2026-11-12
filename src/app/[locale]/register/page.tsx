import { notFound, redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getEnabledSocialProviders } from "@/lib/auth-providers";
import { AuthShell } from "@/components/auth/auth-shell";
import { hasLocale } from "@/i18n/get-dictionary";
import { withLocale } from "@/lib/i18n-path";
import { getSession } from "@/lib/session";
import { tenantSignInRedirectPath } from "@/lib/tenant-login-redirect";

type RegisterPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
};

export default async function RegisterPage({
  params,
  searchParams,
}: RegisterPageProps) {
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

  return (
    <AuthShell>
      <AuthForm
        mode="sign-up"
        next={nextPath}
        providers={getEnabledSocialProviders()}
      />
    </AuthShell>
  );
}
