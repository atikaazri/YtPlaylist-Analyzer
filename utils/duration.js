// Duration utilities: parse ISO 8601, "HH:MM:SS", and format seconds.

export function parseISODuration(iso) {
  if (!iso || typeof iso !== "string") return 0;
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const h = parseInt(match[1] || "0", 10);
  const m = parseInt(match[2] || "0", 10);
  const s = parseInt(match[3] || "0", 10);
  return h * 3600 + m * 60 + s;
}

export function parseClockDuration(text) {
  if (!text || typeof text !== "string") return 0;
  const cleaned = text.trim().replace(/\s+/g, "");
  if (!/^\d+(:\d{1,2}){0,2}$/.test(cleaned)) return 0;
  const parts = cleaned.split(":").map(n => parseInt(n, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

export function formatSeconds(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = n => n.toString().padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

export function summarizeDuration(seconds) {
  return {
    totalSeconds: seconds,
    totalHours: +(seconds / 3600).toFixed(2),
    totalMinutes: +(seconds / 60).toFixed(1),
    pretty: formatSeconds(seconds),
    clock: formatClock(seconds),
    watchAt125: formatSeconds(seconds / 1.25),
    watchAt150: formatSeconds(seconds / 1.5),
    watchAt175: formatSeconds(seconds / 1.75),
    watchAt200: formatSeconds(seconds / 2)
  };
}
