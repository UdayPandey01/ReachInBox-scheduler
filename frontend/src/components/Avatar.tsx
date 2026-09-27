import { useState } from "react";

export function Avatar({ name, src }: { name: string; src: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (src && !imageFailed) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-dark">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
