import { useCallback, useEffect, useState } from "react";
import { api, type EmailRow, type EmailTab, type Page, type User } from "../../lib/api";
import { Button } from "../../components/Button";
import { Pagination } from "../../components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../../components/States";
import { Toast, type ToastMessage } from "../../components/Toast";
import { Logo } from "../../components/Logo";
import { FilterIcon, MenuIcon, RefreshIcon, SearchIcon } from "../../components/icons";
import { ComposePage } from "../compose/ComposePage";
import { EmailDetailPage } from "./EmailDetailPage";
import { EmailList } from "./EmailList";
import { Sidebar } from "./Sidebar";

const PAGE_SIZE = 20;

const tabStatuses: Record<EmailTab, string[]> = {
  scheduled: ["scheduled", "processing"],
  sent: ["sent", "failed"],
};

const slackResultMessages: Record<string, ToastMessage> = {
  connected: { text: "Slack connected. Choose a channel for alerts.", tone: "success" },
  cancelled: { text: "Slack connection was cancelled.", tone: "error" },
  invalid_state: { text: "Slack connection expired. Please try again.", tone: "error" },
  error: { text: "Couldn't connect Slack. Please try again.", tone: "error" },
};

function readSlackResultFromUrl() {
  const slackResult = new URLSearchParams(window.location.search).get("slack");

  if (slackResult) {
    window.history.replaceState(null, "", window.location.pathname);
  }

  return slackResult ? (slackResultMessages[slackResult] ?? null) : null;
}

type View = { name: "list" } | { name: "compose" } | { name: "email"; emailId: string };

type DashboardPageProps = {
  user: User;
  onLoggedOut: () => void;
};

export function DashboardPage({ user, onLoggedOut }: DashboardPageProps) {
  const [view, setView] = useState<View>({ name: "list" });
  const [tab, setTab] = useState<EmailTab>("scheduled");
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [emails, setEmails] = useState<Page<EmailRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<EmailTab, number | null>>({ scheduled: null, sent: null });
  const [toast, setToast] = useState<ToastMessage | null>(readSlackResultFromUrl);

  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!menuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setQuery(searchText.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchText]);

  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setError(null);

    const request = query
      ? api.searchEmails({ q: query, status: status || tabStatuses[tab].join(","), page, limit: PAGE_SIZE })
      : api.listEmails(tab, { status, page, limit: PAGE_SIZE });

    request
      .then((result) => {
        if (!ignore) setEmails(result);
      })
      .catch((err: Error) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [tab, query, status, page, reloadKey]);

  useEffect(() => {
    Promise.all([
      api.listEmails("scheduled", { page: 1, limit: 1 }),
      api.listEmails("sent", { page: 1, limit: 1 }),
    ])
      .then(([scheduled, sent]) => setCounts({ scheduled: scheduled.total, sent: sent.total }))
      .catch(() => setCounts({ scheduled: null, sent: null }));
  }, [tab, reloadKey]);

  function openTab(nextTab: EmailTab) {
    if (nextTab !== tab) setEmails(null);
    setMenuOpen(false);
    setView({ name: "list" });
    setTab(nextTab);
    setStatus("");
    setPage(1);
  }

  function chooseStatus(nextStatus: string) {
    setStatus(nextStatus);
    setPage(1);
    setFilterOpen(false);
  }

  async function logout() {
    try {
      await api.logout();
      onLoggedOut();
    } catch (err) {
      setToast({ text: (err as Error).message, tone: "error" });
    }
  }

  const reload = () => setReloadKey((key) => key + 1);

  const toastElement = <Toast toast={toast} onDismiss={dismissToast} />;

  if (view.name === "compose") {
    return (
      <>
        <ComposePage
          onBack={() => setView({ name: "list" })}
          onScheduled={(totalEmails) => {
            setToast({ text: `${totalEmails} emails scheduled`, tone: "success" });
            openTab("scheduled");
            reload();
          }}
        />
        {toastElement}
      </>
    );
  }

  if (view.name === "email") {
    return <EmailDetailPage emailId={view.emailId} user={user} onBack={() => setView({ name: "list" })} />;
  }

  const filtering = Boolean(query || status);

  return (
    <div className="min-h-screen bg-white lg:flex">
      <header
        className="sticky z-30 flex items-center gap-3 border-b border-line bg-white/95 px-3 py-2.5 backdrop-blur lg:hidden"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className="rounded-full p-2 text-ink hover:bg-field"
        >
          <MenuIcon width={22} height={22} />
        </button>
        <Logo />
        <button
          type="button"
          onClick={() => setView({ name: "compose" })}
          className="ml-auto rounded-full border border-brand px-4 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft"
        >
          Compose
        </button>
      </header>

      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-white shadow-xl transition-[transform,visibility] duration-200 lg:visible lg:static lg:z-auto lg:w-auto lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none ${
          menuOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <Sidebar
          user={user}
          tab={tab}
          counts={counts}
          onTabChange={openTab}
          onCompose={() => {
            setMenuOpen(false);
            setView({ name: "compose" });
          }}
          onLogout={logout}
          onToast={setToast}
        />
      </div>

      <main className="min-w-0 flex-1 px-3 pt-3 pb-8 sm:px-4 lg:pt-6 lg:pr-6 lg:pl-4">
        <div className="mb-3 flex rounded-xl bg-field p-1 lg:hidden" role="tablist" aria-label="Email folders">
          {(["scheduled", "sent"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              onClick={() => openTab(item)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm capitalize transition-colors ${
                tab === item ? "bg-white font-semibold text-ink shadow-sm" : "text-muted"
              }`}
            >
              {item}
              <span className="text-xs font-normal text-muted">{counts[item] ?? ""}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-56 lg:max-w-[860px]">
            <span className="sr-only">Search emails</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search"
              className="w-full rounded-full bg-field py-2.5 pr-4 pl-11 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/20"
            />
          </label>

          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((open) => !open)}
              aria-label="Filter by status"
              aria-expanded={filterOpen}
              className={`rounded-full p-2.5 hover:bg-field ${status ? "text-brand" : "text-muted"}`}
            >
              <FilterIcon />
            </button>
            {filterOpen && (
              <>
                <button type="button" aria-label="Close filter" className="fixed inset-0 z-10 cursor-default" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-line bg-white p-1 shadow-lg">
                  {["", ...tabStatuses[tab]].map((option) => (
                    <button
                      key={option || "all"}
                      type="button"
                      onClick={() => chooseStatus(option)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm capitalize hover:bg-field ${
                        status === option ? "font-semibold text-brand" : ""
                      }`}
                    >
                      {option || "All"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button type="button" onClick={reload} aria-label="Refresh" className="rounded-full p-2.5 text-muted hover:bg-field">
            <RefreshIcon />
          </button>

          {emails && (
            <div className="ml-auto shrink-0">
              <Pagination
                page={emails.page}
                limit={emails.limit}
                total={emails.total}
                totalPages={emails.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>

        <h1 className="sr-only">{tab === "scheduled" ? "Scheduled Emails" : "Sent Emails"}</h1>

        {status && (
          <p className="px-4 pt-3 text-xs text-muted">
            Showing <span className="font-medium capitalize text-ink">{status}</span> ·{" "}
            <button type="button" className="text-brand hover:underline" onClick={() => chooseStatus("")}>
              clear
            </button>
          </p>
        )}

        <section className="mt-2">
          {loading && (!emails || emails.items.length === 0) ? (
            <LoadingState label="Loading emails…" />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : !emails || emails.items.length === 0 ? (
            <EmptyState
              title={filtering ? "No matching emails" : tab === "scheduled" ? "No scheduled emails" : "No sent emails yet"}
              description={
                filtering
                  ? "Try a different search term or status."
                  : tab === "scheduled"
                    ? "Compose a new email to schedule your first campaign."
                    : "Sent and failed emails will appear here."
              }
              action={
                !filtering && tab === "scheduled" ? (
                  <Button variant="outline" onClick={() => setView({ name: "compose" })}>
                    Compose New Email
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className={loading ? "opacity-60 transition-opacity" : undefined}>
              <EmailList tab={tab} emails={emails.items} onOpen={(emailId) => setView({ name: "email", emailId })} />
            </div>
          )}
        </section>
      </main>

      {toastElement}
    </div>
  );
}
