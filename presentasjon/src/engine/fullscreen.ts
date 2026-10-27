export function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => undefined);
    return;
  }
  document.documentElement.requestFullscreen().catch(() => undefined);
}
