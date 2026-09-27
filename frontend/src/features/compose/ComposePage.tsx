import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { api, type AttachmentUpload, type Sender } from "../../lib/api";
import { parseLeads } from "../../lib/leads";
import { AttachmentCard, formatBytes } from "../../components/AttachmentCard";
import { Button } from "../../components/Button";
import { Input } from "../../components/Field";
import { Modal } from "../../components/Modal";
import { LoadingState } from "../../components/States";
import { ArrowLeftIcon, CalendarIcon, ChevronDownIcon, ClockIcon, CloseIcon, PaperclipIcon, UploadIcon } from "../../components/icons";

const ADD_SENDER = "add-sender";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const VISIBLE_CHIPS = 3;
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENTS_BYTES = 10 * 1024 * 1024;
const PREVIEWABLE_IMAGES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

type PendingAttachment = {
  id: string;
  file: File;
  imageUrl: string | null;
};

function readAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error(`Couldn't read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function toAttachmentUploads(attachments: PendingAttachment[]): Promise<AttachmentUpload[]> {
  return Promise.all(
    attachments.map(async ({ file }) => ({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      contentBase64: await readAsBase64(file),
    })),
  );
}

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function tomorrowAt(hour?: number) {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  if (hour !== undefined) date.setHours(hour, 0, 0, 0);
  return date;
}

const sendTimePresets = [
  { label: "Tomorrow", date: () => tomorrowAt() },
  { label: "Tomorrow, 10:00 AM", date: () => tomorrowAt(10) },
  { label: "Tomorrow, 11:00 AM", date: () => tomorrowAt(11) },
  { label: "Tomorrow, 3:00 PM", date: () => tomorrowAt(15) },
];

const underlineInput =
  "w-full border-b border-line bg-transparent py-2 text-sm outline-none placeholder:text-[#b0b4ba] focus:border-brand";

const smallBoxInput =
  "w-20 rounded-md border border-line px-3 py-2 text-sm outline-none placeholder:text-[#b0b4ba] focus:border-brand";

type ComposePageProps = {
  onBack: () => void;
  onScheduled: (totalEmails: number) => void;
};

export function ComposePage({ onBack, onScheduled }: ComposePageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const [senders, setSenders] = useState<Sender[] | null>(null);
  const [sendersError, setSendersError] = useState<string | null>(null);
  const [senderId, setSenderId] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [invalidRecipients, setInvalidRecipients] = useState<string[]>([]);
  const [recipientDraft, setRecipientDraft] = useState("");
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [delaySeconds, setDelaySeconds] = useState("");
  const [hourlyLimit, setHourlyLimit] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [sendAt, setSendAt] = useState(() => toLocalInputValue(new Date()));
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

  const [addSenderOpen, setAddSenderOpen] = useState(false);
  const [newSenderEmail, setNewSenderEmail] = useState("");
  const [newSenderName, setNewSenderName] = useState("");
  const [addSenderError, setAddSenderError] = useState<string | null>(null);
  const [addingSender, setAddingSender] = useState(false);

  useEffect(() => {
    api
      .getSenders()
      .then((loadedSenders) => {
        setSenders(loadedSenders);
        setSenderId(loadedSenders[0]?.id ?? "");
      })
      .catch((err: Error) => setSendersError(err.message));
  }, []);

  useEffect(() => {
    return () => {
      for (const attachment of attachmentsRef.current) {
        if (attachment.imageUrl) URL.revokeObjectURL(attachment.imageUrl);
      }
    };
  }, []);

  function addAttachments(files: FileList) {
    const added = [...files].map((file) => ({
      id: crypto.randomUUID(),
      file,
      imageUrl: PREVIEWABLE_IMAGES.includes(file.type) ? URL.createObjectURL(file) : null,
    }));
    const next = [...attachments, ...added];
    const totalBytes = next.reduce((total, attachment) => total + attachment.file.size, 0);

    if (next.length > MAX_ATTACHMENTS || totalBytes > MAX_ATTACHMENTS_BYTES) {
      for (const attachment of added) {
        if (attachment.imageUrl) URL.revokeObjectURL(attachment.imageUrl);
      }
      setFormError(`Attach up to ${MAX_ATTACHMENTS} files, 10 MB in total.`);
      return;
    }

    setAttachments(next);
    setFormError(null);
  }

  function removeAttachment(id: string) {
    const attachment = attachments.find((item) => item.id === id);
    if (attachment?.imageUrl) URL.revokeObjectURL(attachment.imageUrl);
    setAttachments((current) => current.filter((item) => item.id !== id));
  }

  function addRecipients(text: string) {
    const parsed = parseLeads(text);

    setRecipients((current) => [...new Set([...current, ...parsed.valid])]);
    setInvalidRecipients((current) => [...new Set([...current, ...parsed.invalid])]);

    return parsed;
  }

  function commitDraft() {
    if (recipientDraft.trim()) {
      addRecipients(recipientDraft);
      setRecipientDraft("");
    }
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === " ") {
      event.preventDefault();
      commitDraft();
    }

    if (event.key === "Backspace" && !recipientDraft && recipients.length > 0) {
      setRecipients((current) => current.slice(0, -1));
    }
  }

  async function readLeadsFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      setFormError("The leads file must be smaller than 5 MB.");
      return;
    }

    const parsed = addRecipients(await file.text());
    setFormError(parsed.valid.length === 0 ? `No valid email addresses were found in ${file.name}.` : null);
  }

  function openSendLater(event?: FormEvent) {
    event?.preventDefault();
    commitDraft();

    const delay = Number(delaySeconds || 0);
    const limit = Number(hourlyLimit || 0);
    const pendingRecipients = recipients.length + parseLeads(recipientDraft).valid.length;

    if (!senderId) return setFormError("Choose a sender.");
    if (pendingRecipients === 0) return setFormError("Add recipients or upload a list of leads.");
    if (!subject.trim()) return setFormError("Add a subject.");
    if (!body.trim()) return setFormError("Write the email body.");
    if (!Number.isInteger(delay) || delay < 0) return setFormError("Delay between emails must be 0 or more seconds.");
    if (!Number.isInteger(limit) || limit < 1) return setFormError("Hourly limit must be at least 1.");

    setFormError(null);
    setScheduleError(null);
    setSendLaterOpen(true);
  }

  async function schedule() {
    const scheduledAt = new Date(sendAt);

    if (Number.isNaN(scheduledAt.getTime())) {
      setScheduleError("Pick a valid date and time.");
      return;
    }

    setScheduling(true);
    setScheduleError(null);

    try {
      const attachmentUploads = await toAttachmentUploads(attachments);

      const result = await api.scheduleEmails({
        senderId,
        subject: subject.trim(),
        body,
        recipients,
        scheduledAt: scheduledAt.toISOString(),
        delayMs: Number(delaySeconds || 0) * 1000,
        hourlyLimit: Number(hourlyLimit),
        attachments: attachmentUploads,
      });

      onScheduled(result.totalEmails);
    } catch (err) {
      setScheduleError((err as Error).message);
      setScheduling(false);
    }
  }

  async function addSender(event: FormEvent) {
    event.preventDefault();
    setAddingSender(true);
    setAddSenderError(null);

    try {
      const sender = await api.createSender(newSenderEmail.trim(), newSenderName.trim());
      setSenders((current) => [...(current ?? []), sender]);
      setSenderId(sender.id);
      setAddSenderOpen(false);
      setNewSenderEmail("");
      setNewSenderName("");
    } catch (err) {
      setAddSenderError((err as Error).message);
    } finally {
      setAddingSender(false);
    }
  }

  const visibleRecipients = showAllRecipients ? recipients : recipients.slice(0, VISIBLE_CHIPS);
  const hiddenCount = recipients.length - visibleRecipients.length;

  return (
    <div className="min-h-screen bg-white">
      <header className="relative flex items-center gap-3 px-4 py-4 md:px-6">
        <button type="button" onClick={onBack} aria-label="Back" className="rounded-full p-1.5 hover:bg-field">
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <h1 className="flex-1 text-xl md:text-2xl">Compose New Email</h1>
        <button
          type="button"
          onClick={() => attachmentInputRef.current?.click()}
          aria-label={`Attach files (${attachments.length} attached)`}
          title="Attach files"
          className={`relative rounded-full p-2 hover:bg-field ${attachments.length > 0 ? "text-brand" : "text-muted"}`}
        >
          <PaperclipIcon width={22} height={22} />
          {attachments.length > 0 && (
            <span className="absolute right-0.5 bottom-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-field px-1 text-[10px] font-medium text-ink">
              {attachments.length}
            </span>
          )}
        </button>
        <input
          ref={attachmentInputRef}
          type="file"
          multiple
          className="hidden"
          aria-label="Attachments"
          onChange={(event) => {
            if (event.target.files?.length) addAttachments(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => openSendLater()}
          aria-label="Pick send time"
          className="rounded-full p-2 text-brand hover:bg-brand-soft"
        >
          <ClockIcon width={22} height={22} />
        </button>
        <button
          type="button"
          onClick={() => openSendLater()}
          className="rounded-full border border-brand px-5 py-2 text-sm text-brand hover:bg-brand-soft"
        >
          Send Later
        </button>

        {sendLaterOpen && (
          <>
            <button
              type="button"
              aria-label="Close send later"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => !scheduling && setSendLaterOpen(false)}
            />
            <div
              role="dialog"
              aria-label="Send Later"
              className="absolute top-full right-4 z-20 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-line bg-white p-5 shadow-xl"
            >
              <h2 className="text-base font-medium">Send Later</h2>

              <label className="relative mt-4 block">
                <span className="sr-only">Pick date &amp; time</span>
                <input
                  type="datetime-local"
                  value={sendAt}
                  onChange={(event) => setSendAt(event.target.value)}
                  className={`${underlineInput} pr-8 [&::-webkit-calendar-picker-indicator]:opacity-0`}
                />
                <CalendarIcon className="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 text-muted" />
              </label>

              <div className="mt-3 flex flex-col">
                {sendTimePresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setSendAt(toLocalInputValue(preset.date()))}
                    className="rounded-md py-2 text-left text-sm text-[#3c4043] hover:text-brand"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <p className="mt-2 text-xs text-muted">
                {recipients.length} emails · {delaySeconds || 0}s apart · max {hourlyLimit}/hour
                {attachments.length > 0 && ` · ${attachments.length} attachment${attachments.length === 1 ? "" : "s"}`}
              </p>

              {scheduleError && (
                <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {scheduleError}
                </p>
              )}

              <div className="mt-6 flex items-center justify-end gap-4">
                <button type="button" onClick={() => setSendLaterOpen(false)} disabled={scheduling} className="text-sm font-medium">
                  Cancel
                </button>
                <Button variant="outline" onClick={schedule} loading={scheduling} className="px-6">
                  Done
                </Button>
              </div>
            </div>
          </>
        )}
      </header>

      {sendersError ? (
        <p className="mx-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{sendersError}</p>
      ) : !senders ? (
        <LoadingState label="Loading senders…" />
      ) : (
        <form onSubmit={openSendLater} noValidate className="mx-auto flex max-w-[1330px] flex-col gap-5 px-4 pt-4 pb-12 md:pr-60 md:pl-60">
          <div className="flex items-center gap-4">
            <span className="w-16 shrink-0 text-sm">From</span>
            <label className="relative">
              <span className="sr-only">Sender</span>
              <select
                value={senderId}
                onChange={(event) => {
                  if (event.target.value === ADD_SENDER) {
                    setAddSenderOpen(true);
                    return;
                  }
                  setSenderId(event.target.value);
                }}
                className="max-w-[70vw] appearance-none truncate rounded-md bg-field py-2 pr-9 pl-3 text-sm outline-none focus:ring-2 focus:ring-brand/20"
              >
                {senders.length === 0 && <option value="">No senders yet</option>}
                {senders.map((sender) => (
                  <option key={sender.id} value={sender.id}>
                    {sender.email}
                  </option>
                ))}
                <option value={ADD_SENDER}>+ Add another sender</option>
              </select>
              <ChevronDownIcon width={16} height={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted" />
            </label>
          </div>

          <div className="flex items-start gap-4">
            <span className="w-16 shrink-0 pt-2 text-sm">To</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-3 border-b border-line py-1 focus-within:border-brand">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {visibleRecipients.map((email) => (
                  <span key={email} className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand-soft px-2.5 py-0.5 text-sm">
                    {email}
                    <button
                      type="button"
                      aria-label={`Remove ${email}`}
                      onClick={() => setRecipients((current) => current.filter((item) => item !== email))}
                      className="text-muted hover:text-ink"
                    >
                      <CloseIcon width={12} height={12} />
                    </button>
                  </span>
                ))}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllRecipients(true)}
                    className="rounded-full border border-brand bg-brand-soft px-2.5 py-0.5 text-sm"
                  >
                    +{hiddenCount}
                  </button>
                )}
                <input
                  value={recipientDraft}
                  onChange={(event) => setRecipientDraft(event.target.value)}
                  onKeyDown={handleDraftKeyDown}
                  onBlur={commitDraft}
                  onPaste={(event) => {
                    event.preventDefault();
                    addRecipients(event.clipboardData.getData("text"));
                  }}
                  placeholder={recipients.length === 0 ? "recipient@example.com" : ""}
                  aria-label="Recipients"
                  className="min-w-40 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-[#b0b4ba]"
                />
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex shrink-0 items-center gap-1.5 py-1 text-sm whitespace-nowrap text-brand hover:text-brand-dark"
                >
                  <UploadIcon width={16} height={16} />
                  Upload List
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) readLeadsFile(file);
                    event.target.value = "";
                  }}
                />
              </div>
              <p className="pt-1.5 text-xs text-muted">
                {recipients.length} email{recipients.length === 1 ? "" : "s"} detected
                {invalidRecipients.length > 0 && (
                  <span className="text-[#c9531b]">
                    {" "}· {invalidRecipients.length} invalid skipped ({invalidRecipients.slice(0, 3).join(", ")}
                    {invalidRecipients.length > 3 ? "…" : ""})
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label htmlFor="subject" className="w-16 shrink-0 text-sm">
              Subject
            </label>
            <input
              id="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Subject"
              maxLength={998}
              className={underlineInput}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <label className="flex items-center gap-3 text-sm">
              Delay between 2 emails
              <input
                type="number"
                min={0}
                value={delaySeconds}
                onChange={(event) => setDelaySeconds(event.target.value)}
                placeholder="00"
                aria-describedby="delay-unit"
                className={smallBoxInput}
              />
              <span id="delay-unit" className="text-xs text-muted">
                sec
              </span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              Hourly Limit
              <input
                type="number"
                min={1}
                value={hourlyLimit}
                onChange={(event) => setHourlyLimit(event.target.value)}
                placeholder="00"
                className={smallBoxInput}
              />
            </label>
          </div>

          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Type Your Reply..."
            aria-label="Email body"
            rows={18}
            className="w-full resize-y rounded-xl bg-[#f9f9f9] p-5 text-sm outline-none placeholder:text-[#b0b4ba] focus:ring-2 focus:ring-brand/20"
          />

          {attachments.length > 0 && (
            <div>
              <div className="flex flex-wrap gap-3">
                {attachments.map((attachment) => (
                  <AttachmentCard
                    key={attachment.id}
                    name={attachment.file.name}
                    size={attachment.file.size}
                    imageUrl={attachment.imageUrl}
                    onRemove={() => removeAttachment(attachment.id)}
                  />
                ))}
              </div>
              <p className="pt-2 text-xs text-muted">
                {attachments.length} of {MAX_ATTACHMENTS} files ·{" "}
                {formatBytes(attachments.reduce((total, attachment) => total + attachment.file.size, 0))} of 10 MB
              </p>
            </div>
          )}

          {formError && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </p>
          )}
        </form>
      )}

      {addSenderOpen && (
        <Modal title="Add sender" onClose={() => setAddSenderOpen(false)}>
          <form onSubmit={addSender} className="flex flex-col gap-4">
            <Input label="Sender name" value={newSenderName} onChange={(event) => setNewSenderName(event.target.value)} placeholder="Jane from Acme" />
            <Input label="Sender email" type="email" value={newSenderEmail} onChange={(event) => setNewSenderEmail(event.target.value)} placeholder="jane@acme.com" />
            <p className="text-xs text-muted">Emails are delivered through Ethereal test SMTP.</p>
            {addSenderError && <p role="alert" className="text-sm text-red-600">{addSenderError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAddSenderOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={addingSender} disabled={!newSenderEmail.trim() || !newSenderName.trim()}>
                Add sender
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
