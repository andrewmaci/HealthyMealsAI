import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecipeDTO } from "@/types";

interface RecipeDisplayProps {
  recipe: RecipeDTO;
}

const formatMacroValue = (value: number, suffix: string) => {
  const sanitized = Number.isFinite(value) ? Math.max(0, value) : 0;
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: sanitized % 1 === 0 ? 0 : 2,
  }).format(sanitized);

  return `${formatted} ${suffix}`;
};

const RecipeDisplay = ({ recipe }: RecipeDisplayProps) => {
  const macroSummary = [
    { label: "Calories", value: formatMacroValue(recipe.macros.kcal, "kcal") },
    { label: "Protein", value: formatMacroValue(recipe.macros.protein, "g") },
    { label: "Carbs", value: formatMacroValue(recipe.macros.carbs, "g") },
    { label: "Fat", value: formatMacroValue(recipe.macros.fat, "g") },
  ];

  return (
    <Card className="gap-0">
      <CardHeader className="flex flex-col gap-4 border-b border-border/50 py-6 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-2xl">Servings</CardTitle>
          <CardDescription>This recipe serves {recipe.servings} people.</CardDescription>
        </div>
        <span className="inline-flex items-center justify-center rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {recipe.servings} servings
        </span>
      </CardHeader>

      <CardContent className="space-y-8 py-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Macros</h3>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {macroSummary.map((item) => (
              <div key={item.label} className="rounded-lg border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Instructions</h3>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-foreground">
            {recipe.recipeText}
          </div>
        </section>
      </CardContent>
    </Card>
  );
};

export default RecipeDisplay;
