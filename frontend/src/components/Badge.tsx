import type { EmailStatus } from "../lib/api";
import { ClockIcon } from "./icons";

export function formatShortDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

const chipClasses: Record<EmailStatus, string> = {
  scheduled: "border-[#f6cfae] bg-[#fff3ea] text-[#c9531b]",
  processing: "border-blue-200 bg-blue-50 text-blue-700",
  sent: "border-transparent bg-[#f0f0f0] text-[#5f6368]",
  failed: "border-red-200 bg-red-50 text-red-600",
};

export function StatusBadge({ status, scheduledAt }: { status: EmailStatus; scheduledAt: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${chipClasses[status]}`}
    >
      {status === "scheduled" ? (
        <>
          <ClockIcon width={13} height={13} />
          {formatShortDateTime(scheduledAt)}
        </>
      ) : (
        <span className="capitalize">{status}</span>
      )}
    </span>
  );
}
