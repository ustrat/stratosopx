import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, put, type ApiError } from "../api";

// Server-backed emergency stop. The server enforces it on every ERP write; this
// context only keeps the UI in step.

type ControlState = {
  paused: boolean;
  setPaused: (paused: boolean) => Promise<void>;
  error: string | null;
};

const ControlContext = createContext<ControlState | null>(null);

export function ControlProvider({ children }: { children: ReactNode }) {
  const [paused, setLocal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ writesPaused: boolean }>("/controls")
      .then((c) => setLocal(c.writesPaused))
      .catch(() => {});
  }, []);

  const setPaused = useCallback(async (next: boolean) => {
    try {
      const res = await put<{ paused: boolean }>("/controls/writes", { paused: next });
      setLocal(res.paused);
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, []);

  return <ControlContext.Provider value={{ paused, setPaused, error }}>{children}</ControlContext.Provider>;
}

export function useControls() {
  const ctx = useContext(ControlContext);
  if (!ctx) throw new Error("useControls must be used inside ControlProvider");
  return ctx;
}

export function KillSwitch({ compact = false }: { compact?: boolean }) {
  const { paused, setPaused, error } = useControls();
  const [busy, setBusy] = useState(false);
  return (
    <div className={`kill-switch${paused ? " is-paused" : ""}${compact ? " compact" : ""}`}>
      <span className="kill-state" role="status">
        <span className="status-dot" />
        {error ?? (paused ? "ERP writes paused" : "ERP writes enabled")}
      </span>
      <button
        type="button"
        className={`btn btn-sm ${paused ? "btn-primary" : "btn-danger"}`}
        aria-pressed={paused}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await setPaused(!paused);
          setBusy(false);
        }}
      >
        {paused ? "Resume writes" : "Pause all writes"}
      </button>
    </div>
  );
}
