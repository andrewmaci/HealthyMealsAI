import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { RecipeListItemVM } from "../types";

type RecipeCardProps = {
  item: RecipeListItemVM;
  className?: string;
};

const RecipeCard = ({ item, className }: RecipeCardProps) => (
  <Card className={cn("h-full", className)}>
    <CardHeader>
      <CardTitle className="line-clamp-2 text-lg leading-tight">{item.title}</CardTitle>
      <CardDescription className="text-xs">Updated {item.updatedAtRelative}</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-3 text-sm">
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{item.macros.kcal}</span> kcal
        </span>
        <span>
          <span className="font-medium text-foreground">{item.macros.protein}</span> g protein
        </span>
        <span>
          <span className="font-medium text-foreground">{item.macros.carbs}</span> g carbs
        </span>
        <span>
          <span className="font-medium text-foreground">{item.macros.fat}</span> g fat
        </span>
      </div>
      <div className="text-xs text-muted-foreground">Servings: {item.servings}</div>
    </CardContent>
    <CardFooter className="flex justify-end">
      <Button asChild size="sm">
        <a href={`/recipes/${item.id}`}>View</a>
      </Button>
    </CardFooter>
  </Card>
);

export default RecipeCard;

