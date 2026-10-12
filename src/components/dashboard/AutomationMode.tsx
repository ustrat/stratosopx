"use client";

import { useState } from "react";
import { automationModes, planAllows, type AutomationMode as Mode } from "@/lib/controls";
import { orderTiers } from "@/lib/pricing";
import { plan } from "@/lib/plan";

export function AutomationMode({ criteriaMet }: { criteriaMet: boolean }) {
  const [mode, setMode] = useState<Mode>("assist");

  return (
    <fieldset className="mode-list">
      <legend className="sr-only">Automation mode</legend>
      {automationModes.map((m) => {
        const inPlan = planAllows(plan.order.id, m.minTier);
        const locked = m.id !== "assist" && (!inPlan || !criteriaMet);
        const reason = !inPlan
          ? `Needs the ${orderTiers.find((t) => t.id === m.minTier)!.name} plan`
          : !criteriaMet
            ? "Locked until launch acceptance is complete"
            : null;
        return (
          <label key={m.id} className={`radio mode${mode === m.id ? " checked" : ""}${locked ? " locked" : ""}`}>
            <input
              type="radio"
              name="automation-mode"
              value={m.id}
              checked={mode === m.id}
              disabled={locked}
              onChange={() => setMode(m.id)}
            />
            <span className="mode-body">
              <strong>{m.name}</strong>
              <span>{m.body}</span>
              {locked && reason && <span className="mode-lock">{reason}</span>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
