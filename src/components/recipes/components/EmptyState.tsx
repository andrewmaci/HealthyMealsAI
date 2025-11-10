import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  ctaHref?: string;
}

const EmptyState = ({ ctaHref = "/recipes/new" }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border p-10 text-center">
    <div className="space-y-2">
      <h3 className="text-xl font-semibold">No recipes yet</h3>
      <p className="text-sm text-muted-foreground">Create your first recipe to see it appear here.</p>
    </div>
    <Button asChild>
      <a href={ctaHref}>Create recipe</a>
    </Button>
  </div>
);

export default EmptyState;
