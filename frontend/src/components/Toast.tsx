import { useEffect } from "react";

export type ToastMessage = {
  text: string;
  tone: "success" | "error";
};

export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timeout);
  }, [toast, onDismiss]);

  if (!toast) {
    return null;
  }

  const toneClasses = toast.tone === "success" ? "bg-ink text-white" : "bg-red-600 text-white";

  return (
    <div
      role="status"
      className={`fixed left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl px-5 py-3 text-center text-sm shadow-lg ${toneClasses}`}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
    >
      {toast.text}
    </div>
  );
}
