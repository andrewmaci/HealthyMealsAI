import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import { AuthFormLayout } from "./AuthFormLayout";
import { FormField } from "./FormField";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";

interface SignUpFormProps {
  redirectUrl?: string;
}

type SignUpField = "email" | "password" | "confirmPassword";

type FieldErrors = Partial<Record<SignUpField | "form", string>>;

const EMAIL_REGEX = /.+@.+\..+/i;
const MIN_PASSWORD_LENGTH = 8;

const getDefaultTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug("Unable to detect timezone", error);
    }
    return "UTC";
  }
};

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

export function SignUpForm({ redirectUrl = "/recipes" }: SignUpFormProps) {
  const [values, setValues] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timezone, setTimezone] = useState<string>(() => getDefaultTimezone());
  const [confirmationRequired, setConfirmationRequired] = useState(false);

  useEffect(() => {
    setTimezone(getDefaultTimezone());
  }, []);

  const clearFieldError = useCallback((field: SignUpField) => {
    setErrors((previous) => {
      let next = previous;

      if (previous[field]) {
        const { [field]: removed, ...rest } = previous;
        void removed;
        next = rest;
      }

      if (next.form) {
        const { form: formError, ...rest } = next;
        void formError;
        next = rest;
      }

      return next;
    });
  }, []);

  const setFieldError = useCallback((field: SignUpField, message: string | undefined) => {
    setErrors((previous) => {
      let next: FieldErrors;

      if (!message) {
        if (!previous[field]) {
          next = previous;
        } else {
          const { [field]: removed, ...rest } = previous;
          void removed;
          next = rest;
        }
      } else {
        next = {
          ...previous,
          [field]: message,
        };
      }

      if (next.form) {
        const { form: formError, ...rest } = next;
        void formError;
        next = rest;
      }

      return next;
    });
  }, []);

  const buildValidationErrors = useCallback(() => {
    const validationErrors: FieldErrors = {};

    const emailError = validateEmail(values.email);
    if (emailError) {
      validationErrors.email = emailError;
    }

    const passwordError = validatePassword(values.password);
    if (passwordError) {
      validationErrors.password = passwordError;
    }

    const confirmPasswordError = validateConfirmPassword(values.password, values.confirmPassword);
    if (confirmPasswordError) {
      validationErrors.confirmPassword = confirmPasswordError;
    }

    return validationErrors;
  }, [values.confirmPassword, values.email, values.password]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setErrors((previous) => {
        if (!previous.form) {
          return previous;
        }

        const { form: formError, ...rest } = previous;
        void formError;
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
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            email: values.email.trim(),
            password: values.password,
            timezone,
          }),
        });

        const contentType = response.headers.get("content-type") ?? "";

        if (!response.ok) {
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
                nextFieldErrors = Object.entries(data.details.fieldErrors).reduce<FieldErrors>(
                  (accumulator, [field, fieldErrors]) => {
                    if (!Array.isArray(fieldErrors) || fieldErrors.length === 0) {
                      return accumulator;
                    }

                    if (field === "email" || field === "password" || field === "confirmPassword") {
                      accumulator[field] = fieldErrors[0];
                    }

                    return accumulator;
                  },
                  {}
                );
              }

              message = data?.error || data?.message;
            } catch (error) {
              if (import.meta.env.DEV) {
                console.debug("Unable to parse sign-up error payload", error);
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
                console.debug("Unable to read sign-up error text", error);
              }
            }
          }

          if (!message) {
            if (response.status === 409) {
              message = "An account with this email already exists.";
            } else if (response.status === 429) {
              message = "Too many sign-up attempts. Please try again later.";
            } else {
              message = response.statusText || "Unable to create account. Please try again.";
            }
          }

          setErrors(() => ({
            ...nextFieldErrors,
            form: message,
          }));
          return;
        }

        // Parse successful response
        if (contentType.includes("application/json")) {
          try {
            const data = (await response.json()) as {
              success?: boolean;
              requiresEmailConfirmation?: boolean;
              message?: string;
            } | null;

            if (data?.requiresEmailConfirmation) {
              setConfirmationRequired(true);
              return;
            }
          } catch (error) {
            if (import.meta.env.DEV) {
              console.debug("Unable to parse sign-up success payload", error);
            }
          }
        }

        // If no email confirmation is required, redirect immediately
        window.location.assign(redirectUrl);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Sign-up request failed", error);
        }

        setErrors((previous) => ({
          ...previous,
          form: "Unable to create account. Please check your connection and try again.",
        }));
      } finally {
        setIsSubmitting(false);
      }
    },
    [buildValidationErrors, redirectUrl, timezone, values.confirmPassword, values.email, values.password]
  );

  const formError = errors.form;

  const footer = useMemo(
    () => (
      <p>
        Already have an account?{" "}
        <a href="/auth/signin" className="font-medium text-primary hover:underline">
          Sign in
        </a>
      </p>
    ),
    []
  );

  // Show email confirmation message if registration succeeded
  if (confirmationRequired) {
    return (
      <AuthFormLayout
        title="Check your email"
        description="We've sent you a confirmation link to complete your registration."
        footer={footer}
      >
        <div className="space-y-4">
          <div
            className="rounded-md border border-primary/60 bg-primary/10 p-4 text-sm text-foreground"
            role="status"
          >
            <p className="font-medium mb-2">Registration successful!</p>
            <p>
              Please check your email inbox and click the confirmation link to activate your account. If you don&apos;t
              see the email, check your spam folder.
            </p>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Already confirmed?{" "}
              <a href="/auth/signin" className="font-medium text-primary hover:underline">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </AuthFormLayout>
    );
  }

  return (
    <AuthFormLayout
      title="Create your account"
      description="Sign up to save preferred meals and receive tailored recommendations."
      footer={footer}
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {formError ? (
          <div
            className="rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {formError}
          </div>
        ) : null}

        <FormField
          label="Email"
          name="email"
          type="email"
          value={values.email}
          onChange={(next) => {
            setValues((current) => ({
              ...current,
              email: next,
            }));
            clearFieldError("email");
          }}
          onBlur={() => {
            setFieldError("email", validateEmail(values.email));
          }}
          autoComplete="email"
          required
          error={errors.email}
        />

        <div className="space-y-3">
          <FormField
            label="Password"
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
            error={errors.password}
          />
          <PasswordStrengthMeter password={values.password} />
        </div>

        <FormField
          label="Confirm password"
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
          error={errors.confirmPassword}
        />

        <div className="rounded-md border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
          <p>
            Your timezone will be set to <span className="font-medium text-foreground">{timezone}</span>. You can change
            this later in your profile settings.
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting} aria-disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthFormLayout>
  );
}
