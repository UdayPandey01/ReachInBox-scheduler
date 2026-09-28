import { useState } from "react";
import type { EmailTab, User } from "../../lib/api";
import { Avatar } from "../../components/Avatar";
import { Logo } from "../../components/Logo";
import type { ToastMessage } from "../../components/Toast";
import { ChevronDownIcon, ClockIcon, LogoutIcon, SendIcon } from "../../components/icons";
import { SlackPanel } from "../slack/SlackPanel";

type SidebarProps = {
  user: User;
  tab: EmailTab;
  counts: Record<EmailTab, number | null>;
  onTabChange: (tab: EmailTab) => void;
  onCompose: () => void;
  onLogout: () => void;
  onToast: (toast: ToastMessage) => void;
};

const navItems = [
  { tab: "scheduled" as const, label: "Scheduled", icon: ClockIcon },
  { tab: "sent" as const, label: "Sent", icon: SendIcon },
];

export function Sidebar({ user, tab, counts, onTabChange, onCompose, onLogout, onToast }: SidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto bg-white px-3 pt-6 pb-4 lg:sticky lg:top-0 lg:h-screen lg:w-[260px] lg:shrink-0">
      <div className="px-3">
        <Logo />
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          className="flex w-full items-center gap-2.5 rounded-xl bg-field px-3 py-2.5 text-left"
        >
          <Avatar name={user.name} src={user.avatarUrl} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{user.name}</span>
            <span className="block truncate text-[11px] text-muted">{user.email}</span>
          </span>
          <ChevronDownIcon className={`shrink-0 text-muted transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          <>
            <button type="button" aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 left-0 z-20 mt-1 rounded-xl border border-line bg-white p-1 shadow-lg">
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogoutIcon width={16} height={16} />
                Logout
              </button>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onCompose}
        className="rounded-full border border-brand py-2 text-sm font-medium text-brand transition-colors hover:bg-brand-soft"
      >
        Compose
      </button>

      <nav className="flex flex-col gap-1 pt-2">
        <p className="px-3 pb-1 text-[11px] tracking-wide text-muted uppercase">Core</p>
        {navItems.map((item) => {
          const active = tab === item.tab;

          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => onTabChange(item.tab)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active ? "bg-brand-soft font-semibold text-ink" : "text-ink hover:bg-field"
              }`}
            >
              <item.icon className="text-[#5f6368]" />
              <span className="flex-1 text-left">{item.label}</span>
              <span className="text-xs font-normal text-muted">{counts[item.tab] ?? ""}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto">
        <SlackPanel onToast={onToast} />
      </div>
    </aside>
  );
}
