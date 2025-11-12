import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, LogIn, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { ProfileCompletionPrompt } from "./ProfileCompletionPrompt";
import { ProfileForm } from "./ProfileForm";
import type { ProfileFormValues } from "./types";
import { useProfile } from "./useProfile";
import { useSaveProfile } from "./useSaveProfile";

const formatTimestamp = (timestamp: string | null) => {
  if (!timestamp) {
    return "";
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.valueOf())) {
    return "";
  }

  return parsed.toLocaleString();
};

type AlertKind = "none" | "success" | "error" | "conflict" | "network";

interface AlertState {
  kind: AlertKind;
  message?: string;
}

export default function ProfileSettings() {
  const { data, status, lastModified, error, refetch } = useProfile();
  const [dismissedPrompt, setDismissedPrompt] = useState(false);
  const [alert, setAlert] = useState<AlertState>({
    kind: "none",
  });
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAlertTimeout = () => {
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
      alertTimeoutRef.current = null;
    }
  };

  const scheduleTransientAlert = () => {
    clearAlertTimeout();
    alertTimeoutRef.current = setTimeout(() => {
      setAlert({ kind: "none" });
      alertTimeoutRef.current = null;
    }, 4000);
  };

  useEffect(() => {
    return () => {
      clearAlertTimeout();
    };
  }, []);

  const dismissAlert = () => {
    clearAlertTimeout();
    setAlert({ kind: "none" });
  };

  const { save, saving } = useSaveProfile({
    lastModified,
    onSuccess() {
      setAlert({
        kind: "success",
        message: "Profile updated successfully.",
      });
      scheduleTransientAlert();
      refetch();
    },
    onConflict() {
      clearAlertTimeout();
      setAlert({
        kind: "conflict",
        message: "Profile has changed elsewhere. Reload to continue.",
      });
    },
    onUnauthorized() {
      clearAlertTimeout();
      setAlert({
        kind: "error",
        message: "Your session expired. Please sign in again.",
      });
    },
    onValidation(details) {
      clearAlertTimeout();
      setAlert({
        kind: "error",
        message: details ?? "Validation failed. Review highlighted fields.",
      });
    },
    onNetwork(message) {
      clearAlertTimeout();
      setAlert({
        kind: "network",
        message: message ?? "Network error. Try again shortly.",
      });
    },
    onServer(message) {
      clearAlertTimeout();
      setAlert({
        kind: "error",
        message: message ?? "Something went wrong while saving.",
      });
    },
  });

  const initialValues = useMemo<ProfileFormValues | null>(() => {
    if (!data) {
      return null;
    }

    return {
      allergens: data.allergens ?? [],
      dislikedIngredients: data.dislikedIngredients ?? [],
      timezone: data.timezone ?? null,
    } satisfies ProfileFormValues;
  }, [data]);

  if (status === "loading" || status === "idle") {
    return (
      <Card className="mx-auto mt-12 w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>Loading your preferences...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading profile</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === "unauthorized") {
    return (
      <Card className="mx-auto mt-12 w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Sign in required</CardTitle>
          <CardDescription>You need to sign in to manage your dietary preferences.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <a href="/sign-in" className="flex items-center gap-2">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              <span>Go to sign in</span>
            </a>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="mx-auto mt-12 w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Profile unavailable</CardTitle>
          <CardDescription>We could not load your profile. Please try again.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium">Failed to load profile</p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "An unexpected error occurred."}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={refetch} disabled={status === "loading"}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (!initialValues || !lastModified) {
    return null;
  }

  const showCompletionPrompt =
    !dismissedPrompt && initialValues.allergens.length === 0 && initialValues.dislikedIngredients.length === 0;

  return (
    <Card className="mx-auto mt-12 w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>
          Manage allergens, disliked ingredients, and your timezone so we can tailor meals to you.
        </CardDescription>
        {lastModified && <p className="text-xs text-muted-foreground">Last updated {formatTimestamp(lastModified)}</p>}
      </CardHeader>
      <CardContent className="space-y-6">
        {alert.kind !== "none" && (
          <div
            role="alert"
            aria-live={alert.kind === "success" ? "polite" : "assertive"}
            className={cn(
              "flex items-start gap-3 rounded-md border p-4 text-sm",
              alert.kind === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
              alert.kind === "network" && "border-amber-200 bg-amber-50 text-amber-900",
              (alert.kind === "error" || alert.kind === "conflict") &&
                "border-destructive/40 bg-destructive/10 text-destructive"
            )}
          >
            {alert.kind === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            ) : (
              <AlertCircle
                className={cn("h-5 w-5", alert.kind === "network" ? "text-amber-600" : "text-destructive")}
                aria-hidden="true"
              />
            )}
            <div className="space-y-1">
              <p className="font-medium">
                {alert.kind === "success"
                  ? "Saved"
                  : alert.kind === "conflict"
                    ? "Update conflict"
                    : alert.kind === "network"
                      ? "Network issue"
                      : "Attention"}
              </p>
              {alert.message && (
                <p
                  className={cn(
                    "text-muted-foreground",
                    alert.kind === "success" && "text-emerald-700",
                    alert.kind === "network" && "text-amber-700"
                  )}
                >
                  {alert.message}
                </p>
              )}
              {alert.kind === "conflict" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    refetch();
                    dismissAlert();
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Reload latest
                </Button>
              )}
              {alert.kind !== "conflict" && alert.kind !== "none" && (
                <Button size="sm" variant="ghost" className="px-0 text-xs" onClick={dismissAlert}>
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        )}
        {showCompletionPrompt && <ProfileCompletionPrompt visible onDismiss={() => setDismissedPrompt(true)} />}
        <ProfileForm initialValues={initialValues} lastModified={lastModified} saving={saving} onSave={save} />
      </CardContent>
    </Card>
  );
}
