"use client";

import { useEffect } from "react";
import type { MockEndpointDefinition } from "./protocol";
import { useMockControls } from "./store";

/** A feature calls this once so the dev panel can list (and break) its endpoints. */
export function useRegisterMockEndpoints(definitions: readonly MockEndpointDefinition[]) {
  const register = useMockControls((s) => s.registerEndpoints);
  useEffect(() => register(definitions), [register, definitions]);
}
