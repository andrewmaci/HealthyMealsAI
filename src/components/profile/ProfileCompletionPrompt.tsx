import { useId } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProfileCompletionPromptProps {
  visible: boolean;
  onDismiss?: () => void;
}

export function ProfileCompletionPrompt({ visible, onDismiss }: ProfileCompletionPromptProps) {
  const descriptionId = useId();

  if (!visible) {
    return null;
  }

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-lg">Complete your profile</CardTitle>
        <CardDescription id={descriptionId}>
          Add allergens and disliked ingredients so we can tailor recommendations and prevent unwanted ingredients.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          We use these preferences to personalize every meal plan and adaptation.
        </p>
        <Button variant="outline" onClick={onDismiss} aria-describedby={descriptionId}>
          Dismiss
        </Button>
      </CardContent>
    </Card>
  );
}
