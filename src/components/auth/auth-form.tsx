"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";

import { GithubMark, GoogleMark } from "@/components/auth/provider-icons";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { useFeatureMessages } from "@/hooks/use-feature-messages";
import { authClient } from "@/lib/auth-client";
import type { SocialProviderId } from "@/lib/auth-providers";
import { LocaleLink, useLocaleRouter } from "@/lib/locale-navigation";

type AuthMode = "sign-in" | "sign-up";

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function mapAuthError(
  message: string,
  status: number | undefined,
  auth: ReturnType<typeof useFeatureMessages<"auth">>,
): { field?: keyof FieldErrors; text: string } {
  const lower = message.toLowerCase();
  if (status === 429 || lower.includes("too many")) {
    return { text: auth.errorRateLimited };
  }
  if (lower.includes("already") && lower.includes("exist")) {
    return { field: "email", text: auth.errorEmailTaken };
  }
  if (lower.includes("banned") || lower.includes("disabled")) {
    return { text: auth.errorUserBanned };
  }
  if (lower.includes("invalid") && lower.includes("password")) {
    return { text: auth.errorInvalidCredentials };
  }
  if (lower.includes("password") && lower.includes("short")) {
    return { field: "password", text: auth.errorPasswordShort };
  }
  return { text: message || auth.failed };
}

export function AuthForm({
  mode,
  next,
  notice,
  providers = [],
}: {
  mode: AuthMode;
  /** Already-sanitised in-app path to land on after signing in. */
  next?: string;
  /** Optional banner, e.g. an expired session. */
  notice?: string;
  /** Social providers configured on the server. */
  providers?: SocialProviderId[];
}) {
  const router = useRouter();
  const { replace } = useLocaleRouter();
  const auth = useFeatureMessages("auth");
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthPending, setOauthPending] = useState<SocialProviderId | null>(null);

  async function signInWithProvider(provider: SocialProviderId) {
    if (oauthPending) {
      return;
    }
    setOauthPending(provider);
    setFormError(null);
    try {
      // Better Auth redirects to the provider; the callback lands back on the
      // requested path. `origin` keeps the locale + next target intact.
      const target = `${window.location.origin}${
        next && next.startsWith("/") ? next : window.location.pathname
      }`;
      await authClient.signIn.social({ provider, callbackURL: target });
    } catch (error) {
      setOauthPending(null);
      setFormError(
        error instanceof Error && error.message ? error.message : auth.oauthFailed,
      );
    }
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const trimmedEmail = email.trim();
    if (mode === "sign-up" && !name.trim()) {
      errors.name = auth.errorNameRequired;
    }
    if (!trimmedEmail) {
      errors.email = auth.errorEmailRequired;
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      errors.email = auth.errorEmailInvalid;
    }
    if (!password) {
      errors.password = auth.errorPasswordRequired;
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = auth.errorPasswordShort;
    }
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setFormError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({
              name: name.trim(),
              email: trimmedEmail,
              password,
            })
          : await authClient.signIn.email({
              email: trimmedEmail,
              password,
            });

      if (result.error) {
        const mapped = mapAuthError(
          result.error.message ?? "",
          result.error.status,
          auth,
        );
        if (mapped.field) {
          setFieldErrors({ [mapped.field]: mapped.text });
        } else {
          setFormError(mapped.text);
        }
        return;
      }

      replace(next ?? "/canvas");
      router.refresh();
    } catch {
      setFormError(auth.failed);
    } finally {
      setIsSubmitting(false);
    }
  }

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  const switchHref = mode === "sign-in" ? "/register" : "/login";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex w-full flex-col gap-5 rounded-2xl border border-zinc-200/80 bg-white/85 p-6 shadow-xl shadow-zinc-900/5 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80 dark:shadow-black/30"
    >
      <header className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {mode === "sign-in" ? auth.signInTitle : auth.signUpTitle}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {mode === "sign-in" ? auth.signInSubtitle : auth.signUpSubtitle}
        </p>
      </header>

      {notice ? (
        <p
          role="status"
          className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60"
        >
          {notice}
        </p>
      ) : null}

      {mode === "sign-up" ? (
        <Field
          label={auth.name}
          htmlFor={nameId}
          hint={
            fieldErrors.name ? (
              <p className="text-[11px] text-red-600 dark:text-red-400">
                {fieldErrors.name}
              </p>
            ) : null
          }
        >
          <Input
            id={nameId}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clearFieldError("name");
            }}
            placeholder={auth.placeholderName}
            autoComplete="name"
            autoFocus
            aria-invalid={Boolean(fieldErrors.name)}
          />
        </Field>
      ) : null}

      <Field
        label={auth.email}
        htmlFor={emailId}
        hint={
          fieldErrors.email ? (
            <p className="text-[11px] text-red-600 dark:text-red-400">
              {fieldErrors.email}
            </p>
          ) : null
        }
      >
        <Input
          id={emailId}
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            clearFieldError("email");
          }}
          placeholder={auth.placeholderEmail}
          autoComplete="email"
          autoFocus={mode === "sign-in"}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={Boolean(fieldErrors.email)}
        />
      </Field>

      <Field
        label={auth.password}
        htmlFor={passwordId}
        hint={
          fieldErrors.password ? (
            <p className="text-[11px] text-red-600 dark:text-red-400">
              {fieldErrors.password}
            </p>
          ) : mode === "sign-up" ? (
            <p className="text-[11px] text-zinc-400">{auth.passwordHint}</p>
          ) : null
        }
      >
        <div className="relative">
          <Input
            id={passwordId}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearFieldError("password");
            }}
            placeholder={
              mode === "sign-in"
                ? auth.placeholderPasswordSignIn
                : auth.placeholderPassword
            }
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            className="pr-10"
            aria-invalid={Boolean(fieldErrors.password)}
          />
          <button
            type="button"
            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label={showPassword ? auth.hidePassword : auth.showPassword}
            title={showPassword ? auth.hidePassword : auth.showPassword}
            onClick={() => setShowPassword((current) => !current)}
          >
            <Icon icon={showPassword ? EyeSlash : Eye} size={15} />
          </button>
        </div>
      </Field>

      {formError ? (
        <p
          className="rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700 ring-1 ring-red-200/70 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/60"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full" size="md">
        {isSubmitting ? (
          <>
            <Loading variant="arc" size={14} color="currentColor" label={auth.submitting} />
            {auth.submitting}
          </>
        ) : mode === "sign-in" ? (
          auth.submitSignIn
        ) : (
          auth.submitSignUp
        )}
      </Button>

      {providers.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2" aria-hidden>
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-[11px] text-zinc-400">{auth.orContinueWith}</span>
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="grid gap-2">
            {providers.map((provider) => (
              <Button
                key={provider}
                type="button"
                variant="secondary"
                size="md"
                className="w-full justify-center gap-2"
                disabled={isSubmitting || oauthPending !== null}
                onClick={() => void signInWithProvider(provider)}
              >
                {oauthPending === provider ? (
                  <Loading variant="arc" size={14} label={auth.submitting} />
                ) : provider === "google" ? (
                  <GoogleMark size={16} />
                ) : (
                  <GithubMark size={16} />
                )}
                {provider === "google"
                  ? auth.continueWithGoogle
                  : auth.continueWithGithub}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <LocaleLink
        href={
          next ? `${switchHref}?next=${encodeURIComponent(next)}` : switchHref
        }
        className="text-center text-xs text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        {mode === "sign-in" ? auth.toSignUp : auth.toSignIn}
      </LocaleLink>
    </form>
  );
}
