"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Kill switch for agent write actions (Legal & Compliance Plan, section 5).
// Sample mode: held in memory for the session, not enforced server-side.

type ExecutionState = {
  paused: boolean;
  setPaused: (paused: boolean) => void;
};

const ExecutionContext = createContext<ExecutionState | null>(null);

export function ExecutionProvider({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);
  return <ExecutionContext.Provider value={{ paused, setPaused }}>{children}</ExecutionContext.Provider>;
}

export function useExecution() {
  const ctx = useContext(ExecutionContext);
  if (!ctx) throw new Error("useExecution must be used inside ExecutionProvider");
  return ctx;
}

export function KillSwitch({ compact = false }: { compact?: boolean }) {
  const { paused, setPaused } = useExecution();
  return (
    <div className={`kill-switch${paused ? " is-paused" : ""}${compact ? " compact" : ""}`}>
      <span className="kill-state" role="status">
        <span className="status-dot" />
        {paused ? "ERP writes paused" : "ERP writes enabled"}
      </span>
      <button
        type="button"
        className={`btn btn-sm ${paused ? "btn-primary" : "btn-danger"}`}
        aria-pressed={paused}
        onClick={() => setPaused(!paused)}
      >
        {paused ? "Resume writes" : "Pause all writes"}
      </button>
    </div>
  );
}
