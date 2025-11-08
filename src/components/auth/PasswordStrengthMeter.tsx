import { useMemo } from "react";

import { cn } from "@/lib/utils";

type StrengthLevel = "empty" | "weak" | "medium" | "strong";

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const level = useMemo<StrengthLevel>(() => {
    if (!password) {
      return "empty";
    }

    const checks = [/[a-z]/, /[A-Z]/, /[0-9]/].reduce((score, regex) => (regex.test(password) ? score + 1 : score), 0);
    const hasMinLength = password.length >= 8;

    if (!hasMinLength || checks === 0) {
      return "weak";
    }

    if (checks === 1) {
      return "weak";
    }

    if (checks === 2) {
      return "medium";
    }

    return "strong";
  }, [password]);

  const bars = [0, 1, 2];

  const strengthLabel = (() => {
    switch (level) {
      case "empty":
        return "Enter a password to check its strength";
      case "weak":
        return "Weak password";
      case "medium":
        return "Medium strength";
      case "strong":
        return "Strong password";
      default:
        return "Enter a password";
    }
  })();

  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        {bars.map((index) => {
          const isActive =
            (level === "weak" && index === 0) ||
            (level === "medium" && index <= 1) ||
            (level === "strong" && index <= 2);

          return (
            <span
              key={index}
              className={cn(
                "flex-1 transition-all",
                index > 0 ? "ml-1" : undefined,
                !isActive && "bg-muted",
                isActive && level === "weak" && "bg-destructive/70",
                isActive && level === "medium" && "bg-amber-400",
                isActive && level === "strong" && "bg-emerald-500"
              )}
              aria-hidden="true"
            />
          );
        })}
      </div>
      <p className={cn("text-xs", level === "weak" ? "text-destructive" : "text-muted-foreground")}>{strengthLabel}</p>
    </div>
  );
}
