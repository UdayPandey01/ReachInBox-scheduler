import type { InputHTMLAttributes, ReactNode } from "react";

const controlClasses =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-brand/15";

function Label({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

export function Input({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <Label label={label}>
      <input className={controlClasses} {...props} />
    </Label>
  );
}
