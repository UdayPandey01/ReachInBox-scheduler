const API_URL = import.meta.env.VITE_API_URL ?? "";

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export type Sender = {
  id: string;
  email: string;
  displayName: string;
};

export type EmailStatus = "scheduled" | "processing" | "sent" | "failed";

export type EmailRow = {
  id: string;
  recipient: string;
  subject: string;
  bodyPreview: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
};

export type EmailDetail = Omit<EmailRow, "bodyPreview"> & {
  body: string;
  error: string | null;
  senderName: string;
  senderEmail: string;
  previewUrl: string | null;
  attachments: AttachmentInfo[];
};

export type AttachmentInfo = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
};

export type AttachmentUpload = {
  filename: string;
  contentType: string;
  contentBase64: string;
};

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type SlackStatus = {
  connected: boolean;
  connection: {
    teamName: string | null;
    channelId: string | null;
    channelName: string | null;
  } | null;
};

export type SchedulePayload = {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  scheduledAt: string;
  delayMs: number;
  hourlyLimit: number;
  attachments: AttachmentUpload[];
};

export type ScheduleResult = {
  campaignId: string;
  totalEmails: number;
};

export type EmailTab = "scheduled" | "sent";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function errorMessage(status: number, serverMessage?: string) {
  if (status === 400) return serverMessage ?? "Please check the details and try again.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 404) return serverMessage ?? "We couldn't find what you were looking for.";
  if (status === 413) return serverMessage ?? "That request is too large.";
  return "Something went wrong on our side. Please try again in a moment.";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (response.status === 401 && path !== "/api/auth/me") {
    window.location.assign("/");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(response.status, data?.message));
  }

  return data as T;
}

function toQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }

  return query.toString();
}

export function attachmentUrl(emailId: string, attachmentId: string) {
  return `${API_URL}/api/emails/${emailId}/attachments/${attachmentId}`;
}

export const googleLoginUrl = `${API_URL}/api/auth/google`;
export const slackConnectUrl = `${API_URL}/api/slack/oauth`;

export const api = {
  getMe: () => request<{ user: User }>("/api/auth/me").then((data) => data.user),

  logout: () => request<void>("/api/auth/logout", { method: "POST" }),

  getSenders: () =>
    request<{ senders: Sender[] }>("/api/senders").then((data) => data.senders),

  createSender: (email: string, displayName: string) =>
    request<{ sender: Sender }>("/api/senders", {
      method: "POST",
      body: JSON.stringify({ email, displayName }),
    }).then((data) => data.sender),

  scheduleEmails: (payload: SchedulePayload) =>
    request<ScheduleResult>("/api/emails/schedule", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listEmails: (tab: EmailTab, params: { status?: string; page: number; limit: number }) =>
    request<Page<EmailRow>>(`/api/emails/${tab}?${toQuery(params)}`),

  getEmail: (id: string) =>
    request<{ email: EmailDetail }>(`/api/emails/${id}`).then((data) => data.email),

  searchEmails: (params: { q: string; status: string; page: number; limit: number }) =>
    request<Page<EmailRow>>(`/api/search/emails?${toQuery(params)}`),

  getSlackStatus: () => request<SlackStatus>("/api/slack/status"),

  setSlackChannel: (channel: string) =>
    request<{ connection: SlackStatus["connection"] }>("/api/slack/channel", {
      method: "PUT",
      body: JSON.stringify({ channel }),
    }),

  disconnectSlack: () => request<void>("/api/slack/disconnect", { method: "POST" }),
};
