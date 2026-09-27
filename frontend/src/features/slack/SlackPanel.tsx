import { useEffect, useState, type FormEvent } from "react";
import { api, slackConnectUrl, type SlackStatus } from "../../lib/api";
import { Button } from "../../components/Button";
import type { ToastMessage } from "../../components/Toast";
import { SlackIcon } from "../../components/icons";

export function SlackPanel({ onToast }: { onToast: (toast: ToastMessage) => void }) {
  const [slack, setSlack] = useState<SlackStatus | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editingChannel, setEditingChannel] = useState(false);
  const [channel, setChannel] = useState("");
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    api
      .getSlackStatus()
      .then(setSlack)
      .catch(() => setLoadError(true));
  }, []);

  async function saveChannel(event: FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      const { connection } = await api.setSlackChannel(channel);
      setSlack({ connected: true, connection });
      setEditingChannel(false);
      onToast({ text: `Rate-limit alerts will post to #${connection?.channelName}`, tone: "success" });
    } catch (err) {
      onToast({ text: (err as Error).message, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);

    try {
      await api.disconnectSlack();
      setSlack({ connected: false, connection: null });
      onToast({ text: "Slack disconnected", tone: "success" });
    } catch (err) {
      onToast({ text: (err as Error).message, tone: "error" });
    } finally {
      setDisconnecting(false);
    }
  }

  const connection = slack?.connection;

  return (
    <div className="rounded-xl bg-field p-4">
      <div className="mb-3 flex items-center gap-2">
        <SlackIcon />
        <span className="text-sm font-semibold">Slack alerts</span>
        {slack && (
          <span className={`ml-auto h-2 w-2 rounded-full ${slack.connected ? "bg-brand" : "bg-gray-300"}`} />
        )}
      </div>

      {loadError ? (
        <p className="text-xs text-red-600">Couldn't load Slack status.</p>
      ) : !slack ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : !connection ? (
        <>
          <p className="mb-3 text-xs text-muted">Get notified when a campaign hits its hourly limit.</p>
          <a href={slackConnectUrl} className="block rounded-full bg-ink px-4 py-2 text-center text-sm font-medium text-white hover:bg-black">
            Connect Slack
          </a>
        </>
      ) : (
        <>
          <dl className="mb-3 space-y-1 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Workspace</dt>
              <dd className="truncate font-medium">{connection.teamName ?? "Connected"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Channel</dt>
              <dd className="truncate font-medium">
                {connection.channelName ? `#${connection.channelName}` : "Not set"}
              </dd>
            </div>
          </dl>

          {editingChannel || !connection.channelName ? (
            <form onSubmit={saveChannel} className="mb-3 flex gap-2">
              <input
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
                placeholder="#channel-name"
                aria-label="Slack channel"
                required
                className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-brand"
              />
              <Button type="submit" className="px-3! py-1.5! text-xs" loading={saving}>
                Save
              </Button>
            </form>
          ) : (
            <button type="button" onClick={() => setEditingChannel(true)} className="mb-3 text-xs font-medium text-brand hover:text-brand-dark">
              Change channel
            </button>
          )}

          <div className="flex gap-2">
            <a href={slackConnectUrl} className="flex-1 rounded-full border border-line px-3 py-1.5 text-center text-xs font-medium hover:bg-gray-50">
              Reconnect
            </a>
            <Button variant="danger" className="flex-1 px-3! py-1.5! text-xs" onClick={disconnect} loading={disconnecting}>
              Disconnect
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
