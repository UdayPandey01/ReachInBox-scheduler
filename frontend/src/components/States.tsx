import type { ReactNode } from "react";
import { Button } from "./Button";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted" role="status">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      {label}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export function ErrorState({ title = "Couldn't load emails", message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center" role="alert">
      <p className="font-medium text-red-600">{title}</p>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
