import type { ReactNode } from "react";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AuthFormLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function AuthFormLayout({ title, description, children, footer, className }: AuthFormLayoutProps) {
  return (
    <Card className={cn("border-border/80 shadow-sm", className)}>
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">{title}</CardTitle>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
      {footer ? (
        <CardFooter className="flex justify-center border-t border-border/60 bg-muted/20 text-sm text-muted-foreground">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}
