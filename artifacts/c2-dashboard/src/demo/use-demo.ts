// Hook only — keeps Fast Refresh happy (hooks/non-components only)
import { useContext } from "react";
import { DemoContext } from "./demo-context-obj";
import type { DemoContextValue } from "./demo-context";

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside <DemoProvider>");
  return ctx;
}
