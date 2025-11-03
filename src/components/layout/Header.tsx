import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeaderProps {
  userEmail: string;
  currentPath: string;
}

const NAV_ITEMS = [
  { href: "/recipes", label: "Recipes" },
  { href: "/profile", label: "Profile" },
];

const normalizePath = (path: string) => {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
};

const Header = ({ userEmail, currentPath }: HeaderProps) => {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const normalizedPath = useMemo(() => normalizePath(currentPath), [currentPath]);

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setSignOutError(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error(response.statusText || "Failed to sign out");
      }

      window.location.assign("/");
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Sign-out request failed", error);
      }

      setSignOutError("Unable to sign out. Please try again.");
      setIsSigningOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <a href="/recipes" className="flex items-center gap-2 text-base font-semibold text-foreground transition hover:text-primary">
          HealthyMealsAI
        </a>

        <nav className="flex flex-1 items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = normalizedPath === item.href || normalizedPath.startsWith(`${item.href}/`);

            return (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden max-w-[14rem] truncate text-sm text-muted-foreground sm:inline" title={userEmail}>
            {userEmail}
          </span>
          <Button variant="outline" size="sm" onClick={handleSignOut} disabled={isSigningOut} aria-disabled={isSigningOut}>
            {isSigningOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>
      {signOutError ? (
        <div className="border-t border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive sm:px-6 lg:px-8">
          {signOutError}
        </div>
      ) : null}
    </header>
  );
};

export default Header;


