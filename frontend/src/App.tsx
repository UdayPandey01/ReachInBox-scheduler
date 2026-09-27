import { useEffect, useState } from "react";
import { api, ApiError, type User } from "./lib/api";
import { LoadingState } from "./components/States";
import { LoginPage } from "./features/auth/LoginPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMe()
      .then(setUser)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status !== 401) {
          setSessionError(error.message);
        }
      })
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) {
    return <LoadingState label="Checking your session…" />;
  }

  if (!user) {
    return <LoginPage sessionError={sessionError} />;
  }

  return <DashboardPage user={user} onLoggedOut={() => setUser(null)} />;
}
