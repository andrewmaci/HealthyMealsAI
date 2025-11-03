import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import { AuthFormLayout } from "./AuthFormLayout";
import { FormField } from "./FormField";

type FieldErrors = Partial<Record<"email", string>>;

const EMAIL_REGEX = /.+@.+\..+/i;

const validateEmail = (value: string): string | undefined => {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Email is required.";
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return "Please enter a valid email address.";
  }

  return undefined;
};

export function RecoverPasswordForm() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formMessage, setFormMessage] = useState<string | undefined>();

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const emailError = validateEmail(email);
      if (emailError) {
        setErrors({ email: emailError });
        return;
      }

      setErrors({});
      setFormMessage(undefined);
      setIsSubmitting(true);

      try {
        const response = await fetch("/api/auth/recover", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            email: email.trim(),
          }),
        });

        if (!response.ok && import.meta.env.DEV) {
          console.debug("Password recovery request returned non-200 status", response.status);
        }

        setIsSuccess(true);
        setFormMessage("If an account exists with this email, you will receive password reset instructions shortly.");
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Password recovery request failed", error);
        }

        setIsSuccess(false);
        setFormMessage("Unable to process your request right now. Please check your connection and try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [email],
  );

  const footer = useMemo(
    () => (
      <p>
        Remembered your password? <a href="/auth/signin" className="font-medium text-primary hover:underline">Return to sign in</a>
      </p>
    ),
    [],
  );

  return (
    <AuthFormLayout
      title="Reset your password"
      description="Enter the email associated with your account and we’ll send a reset link if it exists."
      footer={footer}
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {formMessage ? (
          <div
            className="rounded-md border border-border/60 bg-muted/10 p-3 text-sm"
            role="status"
            aria-live="polite"
          >
            {formMessage}
          </div>
        ) : null}

        <FormField
          label="Email"
          name="email"
          type="email"
          value={email}
          onChange={(next) => {
            setEmail(next);
            setErrors((previous) => {
              if (!previous.email) {
                return previous;
              }

              const { email: _removed, ...rest } = previous;
              return rest;
            });
            setFormMessage(undefined);
            setIsSuccess(false);
          }}
          onBlur={() => {
            const emailError = validateEmail(email);
            setErrors((previous) => {
              if (!emailError) {
                if (!previous.email) {
                  return previous;
                }

                const { email: _removed, ...rest } = previous;
                return rest;
              }

              return {
                ...previous,
                email: emailError,
              };
            });
          }}
          autoComplete="email"
          required
          error={errors.email}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting} aria-disabled={isSubmitting}>
          {isSubmitting ? "Sending instructions…" : "Send reset link"}
        </Button>
      </form>
      {isSuccess ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Tip: Check your spam or junk folder if you don’t see an email within a few minutes.
        </p>
      ) : null}
    </AuthFormLayout>
  );
}


