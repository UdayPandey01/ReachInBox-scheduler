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
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-sm shadow-lg ${toneClasses}`}
    >
      {toast.text}
    </div>
  );
}
