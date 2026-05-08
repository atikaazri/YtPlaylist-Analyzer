// yt-dlp command builder. Returns a shell-safe command string for the requested
// options. The extension never executes anything itself; the user copies and runs.

function shellEscape(value, platform) {
  if (value === undefined || value === null || value === "") return "";
  const s = String(value);
  if (platform === "windows") {
    if (/[\s"&|<>^]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }
  if (/^[A-Za-z0-9_./@%:=+,\-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

const FORMAT_PRESETS = {
  best:        "bestvideo*+bestaudio/best",
  best1080:    "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
  best720:     "bestvideo[height<=720]+bestaudio/best[height<=720]",
  best480:     "bestvideo[height<=480]+bestaudio/best[height<=480]",
  audio_best:  null,
  audio_mp3:   null,
  audio_opus:  null
};

const FORMAT_LABELS = {
  best:        "Best video + audio",
  best1080:    "Best up to 1080p",
  best720:     "Best up to 720p",
  best480:     "Best up to 480p",
  audio_best:  "Audio only (best, native)",
  audio_mp3:   "Audio only (MP3)",
  audio_opus:  "Audio only (Opus)"
};

export function getFormatLabels() {
  return FORMAT_LABELS;
}

/**
 * Build a yt-dlp command.
 * @param {object} opts
 * @param {string} opts.url               Playlist or video URL.
 * @param {string} [opts.format]          Key from FORMAT_PRESETS (default "best").
 * @param {number} [opts.start]           Playlist start index (1-based).
 * @param {number} [opts.end]             Playlist end index (inclusive).
 * @param {string} [opts.outputDir]       Download directory.
 * @param {string} [opts.filenameTemplate] yt-dlp output template.
 * @param {boolean} [opts.thumbnail]      Embed thumbnail.
 * @param {boolean} [opts.metadata]       Embed metadata.
 * @param {boolean} [opts.subtitles]      Embed/download subtitles.
 * @param {boolean} [opts.autoSubs]       Include auto-generated subtitles.
 * @param {boolean} [opts.comments]       Save comments JSON sidecar.
 * @param {boolean} [opts.writeInfoJson]  Save .info.json metadata sidecar.
 * @param {boolean} [opts.writeDescription] Save description sidecar.
 * @param {string} [opts.subLangs]        Comma-separated sub langs.
 * @param {string} [opts.archive]         Path to download archive file.
 * @param {string} [opts.platform]        "windows" | "unix" (default "unix").
 * @returns {string} command string
 */
export function buildYtdlpCommand(opts = {}) {
  const platform = opts.platform === "windows" ? "windows" : "unix";
  const args = [];

  args.push("yt-dlp");

  const fmtKey = opts.format || "best";
  if (fmtKey === "audio_best" || fmtKey === "audio_mp3" || fmtKey === "audio_opus") {
    args.push("-x"); // extract audio
    if (fmtKey === "audio_mp3") args.push("--audio-format", "mp3");
    else if (fmtKey === "audio_opus") args.push("--audio-format", "opus");
    else args.push("--audio-format", "best");
    args.push("--audio-quality", "0");
  } else {
    const preset = FORMAT_PRESETS[fmtKey] || FORMAT_PRESETS.best;
    if (preset) args.push("-f", preset);
    args.push("--merge-output-format", "mp4");
  }

  if (opts.start && Number(opts.start) > 0) {
    args.push("--playlist-start", String(opts.start));
  }
  if (opts.end && Number(opts.end) > 0) {
    args.push("--playlist-end", String(opts.end));
  }

  if (opts.thumbnail) args.push("--embed-thumbnail", "--write-thumbnail");
  if (opts.metadata) args.push("--embed-metadata");
  if (opts.subtitles) {
    args.push("--write-subs", "--embed-subs");
    if (opts.autoSubs) args.push("--write-auto-subs");
    args.push("--sub-langs", opts.subLangs && opts.subLangs.trim() ? opts.subLangs.trim() : "en.*");
    args.push("--convert-subs", "srt");
  }
  if (opts.comments) args.push("--write-comments");
  if (opts.writeInfoJson) args.push("--write-info-json");
  if (opts.writeDescription) args.push("--write-description");
  if (opts.archive && opts.archive.trim()) {
    args.push("--download-archive", opts.archive.trim());
  }

  // Output template + directory.
  const filenameTemplate = (opts.filenameTemplate && opts.filenameTemplate.trim())
    || "%(playlist_index)s - %(title).200B [%(id)s].%(ext)s";
  let outputPath = filenameTemplate;
  if (opts.outputDir && opts.outputDir.trim()) {
    const dir = opts.outputDir.trim();
    const sep = platform === "windows" ? "\\" : "/";
    const cleanDir = dir.replace(/[\\/]+$/, "");
    outputPath = `${cleanDir}${sep}${filenameTemplate}`;
  }
  args.push("-o", outputPath);

  // Always restrict filenames so they are safe across platforms.
  args.push("--restrict-filenames");
  args.push("--no-overwrites");
  args.push("--continue");
  args.push("--ignore-errors");

  // The URL goes last.
  args.push(opts.url || "");

  // Escape per platform.
  return args.map(a => shellEscape(a, platform)).join(" ");
}

export function defaultOptions() {
  return {
    format: "best",
    start: "",
    end: "",
    outputDir: "",
    filenameTemplate: "%(playlist_index)s - %(title).200B [%(id)s].%(ext)s",
    thumbnail: true,
    metadata: true,
    subtitles: false,
    autoSubs: false,
    comments: false,
    writeInfoJson: false,
    writeDescription: false,
    subLangs: "en.*",
    archive: "",
    platform: "unix"
  };
}
