import { useState } from "react";
import { googleLoginUrl } from "../../lib/api";
import { GoogleIcon } from "../../components/icons";
import { Logo } from "../../components/Logo";

export function LoginPage({ sessionError }: { sessionError: string | null }) {
  const [redirecting, setRedirecting] = useState(false);
  const loginError = new URLSearchParams(window.location.search).get("error") ?? sessionError;

  function startGoogleLogin() {
    setRedirecting(true);
    window.location.assign(googleLoginUrl);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="w-full max-w-[430px] rounded-lg border border-line bg-white px-6 py-12 sm:px-12">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-center text-[32px] font-semibold">Login</h1>

        {loginError && (
          <p role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {loginError}
          </p>
        )}

        <button
          type="button"
          onClick={startGoogleLogin}
          disabled={redirecting}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-soft px-4 py-3 text-sm text-ink transition-colors hover:bg-[#dcefe0] disabled:cursor-wait disabled:opacity-70"
        >
          {redirecting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          ) : (
            <GoogleIcon width={16} height={16} />
          )}
          {redirecting ? "Redirecting to Google…" : "Login with Google"}
        </button>

        <p className="mt-6 text-center text-xs text-muted">Sign in with your Google account to schedule and track emails.</p>
      </div>
    </main>
  );
}
