import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import ControlGraph from "./ControlGraph";
import AmbientSignals from "./AmbientSignals";

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
    <motion.div className="login-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div
        className="login-backdrop"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <ControlGraph />
        <AmbientSignals login />
        <div className="login-grid-glow" />
      </motion.div>
      <motion.section
        className="login-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        <div className="login-brand" aria-hidden="true"><span>IA</span></div>
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
          <AnimatePresence initial={false}>
            {error && (
              <motion.div
                className="login-error"
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
          <button type="submit" disabled={loading || username.trim().length < 3}>
            {loading ? "Preparing workspace…" : "Continue"}
          </button>
        </form>
        <p className="login-note">Your login ends when this page is refreshed.</p>
      </motion.section>
    </motion.div>
  );
}
