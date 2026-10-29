"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFeatureMessages } from "@/hooks/use-feature-messages";
import { authClient } from "@/lib/auth-client";
import { LocaleLink, useLocaleRouter } from "@/lib/locale-navigation";

type AuthMode = "sign-in" | "sign-up";

type AuthFormProps = {
  mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { replace } = useLocaleRouter();
  const auth = useFeatureMessages("auth");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "sign-up") {
        const result = await authClient.signUp.email({
          name: name.trim() || email.split("@")[0] || "User",
          email: email.trim(),
          password,
        });
        if (result.error) {
          setErrorMessage(result.error.message || auth.failed);
          return;
        }
      } else {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (result.error) {
          setErrorMessage(result.error.message || auth.failed);
          return;
        }
      }

      replace("/canvas");
      router.refresh();
    } catch {
      setErrorMessage(auth.failed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-sm flex-col gap-4"
    >
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {mode === "sign-in" ? auth.signInTitle : auth.signUpTitle}
      </h1>

      {mode === "sign-up" ? (
        <Field label={auth.name}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
          />
        </Field>
      ) : null}

      <Field label={auth.email}>
        <Input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
      </Field>

      <Field label={auth.password}>
        <Input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={
            mode === "sign-in" ? "current-password" : "new-password"
          }
        />
      </Field>

      {errorMessage ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {mode === "sign-in" ? auth.submitSignIn : auth.submitSignUp}
      </Button>

      <LocaleLink
        href={mode === "sign-in" ? "/register" : "/login"}
        className="text-center text-sm text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
      >
        {mode === "sign-in" ? auth.toSignUp : auth.toSignIn}
      </LocaleLink>
    </form>
  );
}
