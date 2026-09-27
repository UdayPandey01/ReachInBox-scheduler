import { useEffect, useState } from "react";
import { api, attachmentUrl, type EmailDetail, type User } from "../../lib/api";
import { AttachmentCard } from "../../components/AttachmentCard";
import { Avatar } from "../../components/Avatar";
import { StatusBadge } from "../../components/Badge";
import { ErrorState, LoadingState } from "../../components/States";
import { ArrowLeftIcon } from "../../components/icons";

type EmailDetailPageProps = {
  emailId: string;
  user: User;
  onBack: () => void;
};

export function EmailDetailPage({ emailId, user, onBack }: EmailDetailPageProps) {
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getEmail(emailId)
      .then(setEmail)
      .catch((err: Error) => setError(err.message));
  }, [emailId]);

  const time = email ? new Date(email.sentAt ?? email.scheduledAt) : null;

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center gap-4 px-4 py-4 md:px-6">
        <button type="button" onClick={onBack} aria-label="Back" className="rounded-full p-1.5 hover:bg-field">
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-xl md:text-2xl">{email?.subject ?? ""}</h1>
        <Avatar name={user.name} src={user.avatarUrl} />
      </header>

      {error ? (
        <ErrorState title="Couldn't load this email" message={error} />
      ) : !email || !time ? (
        <LoadingState label="Loading email…" />
      ) : (
        <article className="mx-auto max-w-5xl px-4 py-6 md:px-8">
          <div className="flex flex-wrap items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white">
              {email.senderName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold">{email.senderName}</span>{" "}
                <span className="text-muted">&lt;{email.senderEmail}&gt;</span>
              </p>
              <p className="text-sm text-muted">to {email.recipient}</p>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted">
              <StatusBadge status={email.status} scheduledAt={email.scheduledAt} />
              {time.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </div>
          </div>

          {email.error && (
            <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 md:ml-13">Delivery failed: {email.error}</p>
          )}

          <p className="mt-6 text-[15px] leading-7 whitespace-pre-wrap md:ml-13">{email.body}</p>

          {email.attachments.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-3 md:ml-13">
              {email.attachments.map((attachment) => {
                const url = attachmentUrl(email.id, attachment.id);
                const isImage = ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(attachment.contentType);

                return (
                  <AttachmentCard
                    key={attachment.id}
                    name={attachment.filename}
                    size={attachment.size}
                    imageUrl={isImage ? url : null}
                    href={url}
                  />
                );
              })}
            </div>
          )}

          {email.previewUrl && (
            <p className="mt-8 text-sm text-muted md:ml-13">
              Delivered to Ethereal test SMTP (not a real inbox).{" "}
              <a href={email.previewUrl} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
                Open in Ethereal
              </a>
            </p>
          )}
        </article>
      )}
    </div>
  );
}
