import { CloseIcon, FileIcon } from "./icons";

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type AttachmentCardProps = {
  name: string;
  size: number;
  imageUrl?: string | null;
  href?: string;
  onRemove?: () => void;
};

export function AttachmentCard({ name, size, imageUrl, href, onRemove }: AttachmentCardProps) {
  const content = (
    <>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-28 w-full object-cover" />
      ) : (
        <span className="flex h-28 w-full items-center justify-center bg-field text-muted">
          <FileIcon width={36} height={36} strokeWidth={1.4} />
        </span>
      )}
      <span className="block px-3 py-2">
        <span className="block truncate text-sm">{name}</span>
        <span className="block text-xs text-muted">{formatBytes(size)}</span>
      </span>
    </>
  );

  return (
    <div className="relative w-48 overflow-hidden rounded-lg border border-line bg-white">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="block hover:bg-[#fafafa]" title={`Open ${name}`}>
          {content}
        </a>
      ) : (
        content
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="absolute top-1.5 right-1.5 rounded-full bg-white/90 p-1 text-muted shadow hover:text-ink"
        >
          <CloseIcon width={12} height={12} />
        </button>
      )}
    </div>
  );
}
