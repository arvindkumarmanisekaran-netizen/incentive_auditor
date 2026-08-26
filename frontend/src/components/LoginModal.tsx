import { useState, type FormEvent } from "react";

interface LoginModalProps {
  onLogin: (username: string) => Promise<void>;
}

export default function LoginModal({ onLogin }: LoginModalProps) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await onLogin(username.trim());
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-backdrop" aria-hidden="true" />
      <section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <div className="login-brand" aria-hidden="true">🧪</div>
        <p className="login-eyebrow">INCENTIVE AUDITOR</p>
        <h1 id="login-title">Open your workspace</h1>
        <p className="login-description">
          Enter your username. We’ll load your existing workspace or prepare a new one.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="workspace-username">Username</label>
          <input
            id="workspace-username"
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter username"
            autoComplete="off"
            autoFocus
            minLength={3}
            maxLength={50}
            pattern="[A-Za-z0-9_.-]+"
            required
            disabled={loading}
          />
          {error && <div className="login-error" role="alert">{error}</div>}
          <button type="submit" disabled={loading || username.trim().length < 3}>
            {loading ? "Preparing workspace…" : "Continue"}
          </button>
        </form>
        <p className="login-note">Your login ends when this page is refreshed.</p>
      </section>
    </div>
  );
}
