import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import { AuthFormLayout } from "./AuthFormLayout";
import { FormField } from "./FormField";

interface SignInFormProps {
  redirectUrl?: string;
}

type SignInField = "email" | "password";

type FieldErrors = Partial<Record<SignInField | "form", string>>;

const validateEmail = (value: string): string | undefined => {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Email is required.";
  }

  const emailRegex = /.+@.+\..+/i;
  if (!emailRegex.test(trimmed)) {
    return "Please enter a valid email address.";
  }

  return undefined;
};

const validatePassword = (value: string): string | undefined => {
  if (!value) {
    return "Password is required.";
  }

  if (value.length < 6) {
    return "Password must be at least 6 characters.";
  }

  return undefined;
};

export function SignInForm({ redirectUrl = "/recipes" }: SignInFormProps) {
  const [values, setValues] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearFieldError = useCallback((field: SignInField) => {
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

  const setFieldError = useCallback((field: SignInField, message: string | undefined) => {
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

    return validationErrors;
  }, [values.email, values.password]);

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
        const response = await fetch("/api/auth/signin", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            email: values.email.trim(),
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
                nextFieldErrors = Object.entries(data.details.fieldErrors).reduce<FieldErrors>(
                  (accumulator, [field, fieldErrors]) => {
                    if (!Array.isArray(fieldErrors) || fieldErrors.length === 0) {
                      return accumulator;
                    }

                    if (field === "email" || field === "password") {
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
                console.debug("Unable to parse sign-in error payload", error);
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
                console.debug("Unable to read sign-in error text", error);
              }
            }
          }

          if (!message) {
            if (response.status === 401) {
              message = "Invalid email or password.";
            } else if (response.status === 429) {
              message = "Too many attempts. Please try again in a few minutes.";
            } else {
              message = response.statusText || "Unable to sign in. Please try again.";
            }
          }

          setErrors(() => ({
            ...nextFieldErrors,
            form: message,
          }));
          return;
        }

        window.location.assign(redirectUrl);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Sign-in request failed", error);
        }

        setErrors((previous) => ({
          ...previous,
          form: "Unable to sign in. Please check your connection and try again.",
        }));
      } finally {
        setIsSubmitting(false);
      }
    },
    [buildValidationErrors, redirectUrl, values.email, values.password]
  );

  const formError = errors.form;

  const footer = useMemo(
    () => (
      <p>
        Don&apos;t have an account?{" "}
        <a href="/auth/signup" className="font-medium text-primary hover:underline">
          Sign up
        </a>
      </p>
    ),
    []
  );

  return (
    <AuthFormLayout
      title="Sign in"
      description="Access your personalized meal plans and saved recipes."
      footer={footer}
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate data-test-id="auth-signin-form">
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
          dataTestId="auth-signin-email-input"
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

        <FormField
          label="Password"
          name="password"
          type="password"
          value={values.password}
          dataTestId="auth-signin-password-input"
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
          autoComplete="current-password"
          required
          error={errors.password}
        />

        <div className="flex items-center justify-between text-sm">
          <a href="/auth/recover" className="font-medium text-primary hover:underline">
            Forgot password?
          </a>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting}
          aria-disabled={isSubmitting}
          data-test-id="auth-signin-submit-button"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthFormLayout>
  );
}
