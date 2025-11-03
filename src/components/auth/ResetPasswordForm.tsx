import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { AuthFormLayout } from "./AuthFormLayout";
import { FormField } from "./FormField";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";

interface ResetPasswordFormProps {
  token: string | null;
  redirectUrl?: string;
}

type ResetField = "password" | "confirmPassword";

type FieldErrors = Partial<Record<ResetField | "form", string>>;

const MIN_PASSWORD_LENGTH = 8;

const validatePassword = (value: string): string | undefined => {
  if (!value) {
    return "Password is required.";
  }

  if (value.length < MIN_PASSWORD_LENGTH) {
    return "Password must be at least 8 characters.";
  }

  if (!/[A-Z]/.test(value)) {
    return "Password must contain at least one uppercase letter.";
  }

  if (!/[a-z]/.test(value)) {
    return "Password must contain at least one lowercase letter.";
  }

  if (!/[0-9]/.test(value)) {
    return "Password must contain at least one number.";
  }

  return undefined;
};

const validateConfirmPassword = (password: string, confirmPassword: string): string | undefined => {
  if (!confirmPassword) {
    return "Please confirm your password.";
  }

  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }

  return undefined;
};

export function ResetPasswordForm({ token, redirectUrl = "/auth/signin" }: ResetPasswordFormProps) {
  const [values, setValues] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const clearFieldError = useCallback((field: ResetField) => {
    setErrors((previous) => {
      let next = previous;

      if (previous[field]) {
        const { [field]: _removed, ...rest } = previous;
        next = rest;
      }

      if (next.form) {
        const { form: _form, ...rest } = next;
        next = rest;
      }

      return next;
    });
  }, []);

  const setFieldError = useCallback((field: ResetField, message: string | undefined) => {
    setErrors((previous) => {
      let next: FieldErrors;

      if (!message) {
        if (!previous[field]) {
          next = previous;
        } else {
          const { [field]: _removed, ...rest } = previous;
          next = rest;
        }
      } else {
        next = {
          ...previous,
          [field]: message,
        };
      }

      if (next.form) {
        const { form: _form, ...rest } = next;
        next = rest;
      }

      return next;
    });
  }, []);

  const buildValidationErrors = useCallback(() => {
    const validationErrors: FieldErrors = {};

    const passwordError = validatePassword(values.password);
    if (passwordError) {
      validationErrors.password = passwordError;
    }

    const confirmPasswordError = validateConfirmPassword(values.password, values.confirmPassword);
    if (confirmPasswordError) {
      validationErrors.confirmPassword = confirmPasswordError;
    }

    return validationErrors;
  }, [values.confirmPassword, values.password]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!token) {
        setErrors({ form: "This password reset link is invalid or has expired." });
        return;
      }

      setErrors((previous) => {
        if (!previous.form) {
          return previous;
        }

        const { form: _form, ...rest } = previous;
        return rest;
      });

      const validationErrors = buildValidationErrors();
      if (Object.keys(validationErrors).length > 0) {
        setErrors((previous) => ({
          ...(previous.form ? { form: previous.form } : {}),
          ...validationErrors,
        }));
        return;
      }

      setIsSubmitting(true);

      try {
        const response = await fetch("/api/auth/reset", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            token,
            password: values.password,
          }),
        });

        if (!response.ok) {
          const contentType = response.headers.get("content-type") ?? "";
          let message: string | undefined;
          let nextFieldErrors: FieldErrors = {};

          if (contentType.includes("application/json")) {
            try {
              const data = (await response.json()) as {
                error?: string;
                message?: string;
                details?: {
                  fieldErrors?: Record<string, string[]>;
                };
              } | null;

              if (data?.details?.fieldErrors) {
                nextFieldErrors = Object.entries(data.details.fieldErrors).reduce<FieldErrors>((accumulator, [field, fieldErrors]) => {
                  if (!Array.isArray(fieldErrors) || fieldErrors.length === 0) {
                    return accumulator;
                  }

                  if (field === "password" || field === "confirmPassword") {
                    accumulator[field] = fieldErrors[0];
                  }

                  return accumulator;
                }, {});
              }

              message = data?.error || data?.message;
            } catch (error) {
              if (import.meta.env.DEV) {
                console.debug("Unable to parse password reset error payload", error);
              }
            }
          } else {
            try {
              const text = await response.text();
              if (text.trim()) {
                message = text;
              }
            } catch (error) {
              if (import.meta.env.DEV) {
                console.debug("Unable to read password reset error text", error);
              }
            }
          }

          if (!message) {
            if (response.status === 400) {
              message = "This password reset link is invalid or has expired.";
            } else {
              message = response.statusText || "Unable to reset password. Please try again.";
            }
          }

          setErrors(() => ({
            ...nextFieldErrors,
            form: message,
          }));
          return;
        }

        setIsSuccess(true);
        setErrors({});

        timeoutRef.current = setTimeout(() => {
          window.location.assign(redirectUrl);
        }, 3000);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Password reset request failed", error);
        }

        setErrors((previous) => ({
          ...previous,
          form: "Unable to reset password. Please check your connection and try again.",
        }));
      } finally {
        setIsSubmitting(false);
      }
    },
    [buildValidationErrors, redirectUrl, token, values.password],
  );

  const formError = errors.form;

  const footer = useMemo(
    () => (
      <p>
        Don&apos;t need to reset your password? <a href="/auth/signin" className="font-medium text-primary hover:underline">Return to sign in</a>
      </p>
    ),
    [],
  );

  const disableInputs = isSubmitting || isSuccess;

  return (
    <AuthFormLayout
      title="Choose a new password"
      description="Enter and confirm your new password to complete the reset."
      footer={footer}
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {!token ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            This password reset link is invalid or has expired. Please request a new reset link.
          </div>
        ) : null}

        {formError ? (
          <div className="rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {formError}
          </div>
        ) : null}

        <div className="space-y-3">
          <FormField
            label="New password"
            name="password"
            type="password"
            value={values.password}
            onChange={(next) => {
              setValues((current) => ({
                ...current,
                password: next,
              }));
              clearFieldError("password");
            }}
            onBlur={() => {
              setFieldError("password", validatePassword(values.password));
            }}
            autoComplete="new-password"
            required
            disabled={disableInputs}
            error={errors.password}
          />
          <PasswordStrengthMeter password={values.password} />
        </div>

        <FormField
          label="Confirm new password"
          name="confirmPassword"
          type="password"
          value={values.confirmPassword}
          onChange={(next) => {
            setValues((current) => ({
              ...current,
              confirmPassword: next,
            }));
            clearFieldError("confirmPassword");
          }}
          onBlur={() => {
            setFieldError("confirmPassword", validateConfirmPassword(values.password, values.confirmPassword));
          }}
          autoComplete="new-password"
          required
          disabled={disableInputs}
          error={errors.confirmPassword}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={disableInputs || !token}
          aria-disabled={disableInputs || !token}
        >
          {isSubmitting ? "Updating password…" : "Update password"}
        </Button>
      </form>

      {isSuccess ? (
        <p className="mt-4 text-xs text-muted-foreground" role="status" aria-live="polite">
          Password updated successfully. Redirecting you to the sign-in page…
        </p>
      ) : null}
    </AuthFormLayout>
  );
}


