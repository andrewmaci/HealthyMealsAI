import { Button } from "@/components/ui/button";
import type { PaginationDTO } from "@/types";

interface PaginationProps {
  pagination: PaginationDTO;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const Pagination = ({ pagination, onPageChange, isLoading }: PaginationProps) => {
  if (pagination.totalPages <= 1) {
    return null;
  }

  const goToPage = (page: number) => {
    const target = clamp(page, 1, pagination.totalPages);

    if (target === pagination.page) {
      return;
    }

    onPageChange(target);
  };

  const pages = Array.from({ length: pagination.totalPages }, (_, index) => index + 1);

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => goToPage(pagination.page - 1)}
        disabled={pagination.page === 1 || isLoading}
        aria-label="Previous page"
      >
        Previous
      </Button>
      {pages.map((page) => (
        <Button
          key={page}
          type="button"
          variant={page === pagination.page ? "default" : "outline"}
          size="sm"
          onClick={() => goToPage(page)}
          aria-current={page === pagination.page ? "page" : undefined}
          disabled={isLoading}
        >
          {page}
        </Button>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => goToPage(pagination.page + 1)}
        disabled={pagination.page === pagination.totalPages || isLoading}
        aria-label="Next page"
      >
        Next
      </Button>
    </nav>
  );
};

export default Pagination;
