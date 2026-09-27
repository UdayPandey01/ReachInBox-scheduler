import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

type PaginationProps = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, limit, total, totalPages, onPageChange }: PaginationProps) {
  if (total === 0) {
    return null;
  }

  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);
  const buttonClasses = "rounded-full p-1.5 text-muted hover:bg-field hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex items-center gap-1 text-sm whitespace-nowrap text-muted">
      <span className="mr-1">
        {first}–{last} of {total}
      </span>
      <button type="button" aria-label="Previous page" className={buttonClasses} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeftIcon />
      </button>
      <button type="button" aria-label="Next page" className={buttonClasses} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        <ChevronRightIcon />
      </button>
    </div>
  );
}
