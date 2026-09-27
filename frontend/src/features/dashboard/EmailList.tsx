import type { EmailRow, EmailTab } from "../../lib/api";
import { formatShortDateTime, StatusBadge } from "../../components/Badge";

type EmailListProps = {
  tab: EmailTab;
  emails: EmailRow[];
  onOpen: (emailId: string) => void;
};

export function EmailList({ tab, emails, onOpen }: EmailListProps) {
  return (
    <ul>
      {emails.map((email) => (
        <li key={email.id} className="border-b border-line">
          <button
            type="button"
            onClick={() => onOpen(email.id)}
            className="flex w-full flex-col gap-1.5 px-4 py-4 text-left text-sm transition-colors hover:bg-[#fafafa] md:flex-row md:items-center md:gap-4"
          >
            <span className="shrink-0 truncate md:w-60">To: {email.recipient}</span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <StatusBadge status={email.status} scheduledAt={email.scheduledAt} />
              <span className="min-w-0 truncate">
                <span className="font-medium">{email.subject}</span>
                {email.bodyPreview && <span className="text-muted"> - {email.bodyPreview}</span>}
              </span>
            </span>
            {tab === "sent" && (
              <span className="shrink-0 text-xs text-muted">
                {email.sentAt ? formatShortDateTime(email.sentAt) : "Not sent"}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
