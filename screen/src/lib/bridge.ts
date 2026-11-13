export type ScreenTimeBridge = NonNullable<Window["ScreenTimeAndroid"]>;

const TRUSTED_HOST = "appassets.androidplatform.net";

/** The bridge is only honoured on the app's own asset origin. A public page never qualifies. */
export function readBridge(): ScreenTimeBridge | null {
  if (typeof window === "undefined") return null;
  if (window.location.protocol !== "https:") return null;
  if (window.location.hostname !== TRUSTED_HOST) return null;
  const native = window.ScreenTimeAndroid;
  if (!native) return null;
  if (typeof native.snapshot !== "function" || typeof native.refresh !== "function") return null;
  if (typeof native.deleteAll !== "function" || typeof native.shareExport !== "function") return null;
  if (typeof native.openUsageAccess !== "function") return null;
  return native;
}
