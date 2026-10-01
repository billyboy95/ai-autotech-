"use client";

import { useEffect } from "react";

/** Registers the local install service worker. It does not record an install event. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* A browser that refuses the worker can still use Add to Home Screen. */
    });
  }, []);
  return null;
}
