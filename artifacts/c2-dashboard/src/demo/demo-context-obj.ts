// Pure TS — just the context object. No components, no hooks.
import { createContext } from "react";
import type { DemoContextValue } from "./demo-context";

export const DemoContext = createContext<DemoContextValue | null>(null);
