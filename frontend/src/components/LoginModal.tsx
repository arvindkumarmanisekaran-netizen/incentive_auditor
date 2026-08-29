import { useEffect, useRef, useState, type FormEvent } from "react";
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
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const displayName = username.trim() || "Your name";

  useEffect(() => {
    const input = usernameInputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    input.select();
  }, []);

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
        <div className="login-content">
          <div className="login-intro">
            <div className="login-brand" aria-hidden="true"><span>IA</span></div>
            <p className="login-eyebrow">INCENTIVE AUDITOR</p>
            <h1 id="login-title">Your name opens your workspace</h1>

            <div className="login-workspace-visual" aria-hidden="true">
              <motion.div
                className="login-person-node"
                animate={{ boxShadow: ["0 0 0 0 rgba(185,255,102,0)", "0 0 0 9px rgba(185,255,102,.08)", "0 0 0 0 rgba(185,255,102,0)"] }}
                transition={{ duration: 2.4, repeat: Infinity }}
              >
                <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" /></svg>
                <span>{displayName}</span>
              </motion.div>

              <div className="login-route">
                <motion.span
                  animate={{ x: [0, 34], opacity: [0, 1, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>

              <div className="login-workspace-node">
                <svg viewBox="0 0 24 24"><path d="M4 7.5h6l1.6 2H20v9.5H4z" /><path d="M4 7.5V5h6l1.6 2H20v2.5" /></svg>
                <div><strong>Personal workspace</strong><span>Private to this name</span></div>
              </div>
            </div>

            <div className="login-outcomes" aria-hidden="true">
              <div><span className="login-outcome-icon existing">↗</span><p><strong>Name found</strong><small>Open your saved workspace</small></p></div>
              <div><span className="login-outcome-icon new">＋</span><p><strong>First visit</strong><small>Create a new workspace</small></p></div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="workspace-username">Enter your name</label>
            <div className="login-input-shell">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" /></svg>
              <input
                ref={usernameInputRef}
                id="workspace-username"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="e.g. Arvind Kumar"
                autoComplete="name"
                autoFocus
                minLength={3}
                maxLength={50}
                required
                disabled={loading}
              />
            </div>
            <p className="login-field-hint"><span>●</span> Use the same name next time to return here</p>
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
              {loading ? "Preparing your workspace…" : "Open my workspace"}
            </button>
          </form>
        </div>
        <p className="login-note">One name → one personal workspace</p>
      </motion.section>
    </motion.div>
  );
}
