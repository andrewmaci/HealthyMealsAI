import type { PaginationDTO } from "@/types";

type ResultsSummaryProps = {
  pagination: PaginationDTO;
  itemsOnPage: number;
};

const ResultsSummary = ({ pagination, itemsOnPage }: ResultsSummaryProps) => {
  if (pagination.totalItems === 0) {
    return <p className="text-sm text-muted-foreground">No recipes found.</p>;
  }

  const start = (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(start + itemsOnPage - 1, pagination.totalItems);

  return (
    <p className="text-sm text-muted-foreground">
      Showing <span className="font-medium">{start}</span>–<span className="font-medium">{end}</span> of {" "}
      <span className="font-medium">{pagination.totalItems}</span> recipes
    </p>
  );
};

export default ResultsSummary;

