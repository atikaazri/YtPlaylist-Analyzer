# YouTube Playlist Analyzer

A Manifest V3 browser extension for **Brave** and **Chrome** that turns any YouTube playlist into a quick analytics view: total duration with a range selector, likes/views summary, comment sentiment, topic detection from titles, and a `yt-dlp` command generator.

The extension runs **entirely in your browser**. No backend, no telemetry, no account required.

---

## ✨ Features

| Feature | Without API key | With API key |
| --- | --- | --- |
| Playlist detection (id, title, URL) | ✅ | ✅ |
| Duration totals + range selector | ✅ (visible side panel only) | ✅ (full playlist) |
| Estimated watch time at 1.25×–2× | ✅ | ✅ |
| Topic / keyword summary from titles | ✅ | ✅ |
| `yt-dlp` command generator | ✅ | ✅ |
| Likes / views aggregation, most & least liked | — | ✅ |
| Comment sentiment analysis (positive / neutral / negative %) | — | ✅ |
| Common positive themes & complaints | — | ✅ |

> Dislike counts were removed from YouTube's public API in 2021 and are no longer surfaced anywhere by Google. The extension acknowledges this gracefully and shows likes only.

---

## 🖼️ Screens


- `screenshots/popup-duration.png` — duration tab with range selector
- `screenshots/popup-stats.png` — likes & views aggregation
- `screenshots/popup-sentiment.png` — comment sentiment breakdown
- `screenshots/popup-topics.png` — topic summary
- `screenshots/popup-ytdlp.png` — `yt-dlp` command generator

---

## 🚀 Installation

1. **Download** this folder (or clone the repo). Make sure `manifest.json` is at its root.
2. Open Brave or Chrome and go to:
   - **Brave:** `brave://extensions`
   - **Chrome:** `chrome://extensions`
3. Toggle **Developer mode** (top-right).
4. Click **Load unpacked** and pick the `yt-playlist-analyzer` folder.
5. The pink ▶ icon appears in your toolbar. Pin it for quick access.

To package it for distribution, just zip the folder contents (everything next to `manifest.json`) and submit to the Chrome Web Store, or share the zip directly.

---

## 🔑 Optional: enable full mode with a free YouTube API key

Some features (likes, views, comment sentiment, full playlists beyond what's visible on the page) require the public **YouTube Data API v3**. The free tier is generous — 10,000 quota units per day — and one full playlist analysis typically costs under 100 units.

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. **APIs & Services → Library** → enable **YouTube Data API v3**.
4. **APIs & Services → Credentials** → **Create credentials → API key**.
5. Click the extension icon → ⚙ settings → paste the key → **Save**.

The key is stored only via `chrome.storage.local` on this device. Requests using it are sent only to `https://www.googleapis.com`.

---

## 🔐 Permissions explained

| Permission | Why |
| --- | --- |
| `storage` | Save your optional API key locally |
| `activeTab` | Read the URL of the playlist tab when you click the extension |
| `scripting` | Inject the playlist-detection content script if it isn't loaded yet |
| `host_permissions: youtube.com` | Read playlist info from the YouTube page DOM |
| `host_permissions: googleapis.com` | Call the YouTube Data API when you provide a key |

There is no analytics, telemetry, remote-code execution, or third-party network call.

---

## 🧭 Usage

1. Open a YouTube playlist or any video that's part of a playlist (URL contains `?list=...`).
2. Click the extension icon.
3. Use the tabs:
   - **Duration** — total + range, 1.25× / 1.5× / 1.75× / 2× watch times.
   - **Stats** — likes/views, most & least liked video.
   - **Sentiment** — fetches top comments and runs a lexicon-based sentiment pass; charts pos/neu/neg.
   - **Topics** — keyword and n-gram frequency over titles.
   - **yt-dlp** — fill the form, copy the generated command.

If you only see the empty state, refresh the YouTube tab and click the extension again.

---

## ⬇ yt-dlp setup

The extension never downloads anything itself — it just builds you a copy-paste-ready command for [yt-dlp](https://github.com/yt-dlp/yt-dlp), the standard open-source command-line tool.

| Platform | Install command |
| --- | --- |
| **macOS** | `brew install yt-dlp ffmpeg` |
| **Linux** | `sudo apt install yt-dlp ffmpeg` (or `pipx install yt-dlp`) |
| **Windows** | `winget install yt-dlp` (also install `ffmpeg`: `winget install Gyan.FFmpeg`) |

`ffmpeg` is required for merging video+audio, embedding thumbnails/metadata, and audio extraction.

### Example commands the generator produces

```
# Whole playlist, 1080p (Linux/macOS)
yt-dlp -f 'bestvideo[height<=1080]+bestaudio/best[height<=1080]' --merge-output-format mp4 \
  --embed-thumbnail --write-thumbnail --embed-metadata \
  -o '~/Videos/Playlist/%(playlist_index)s - %(title).200B [%(id)s].%(ext)s' \
  --restrict-filenames --no-overwrites --continue --ignore-errors \
  'https://www.youtube.com/playlist?list=PLxxxxxx'

# Videos 10–30 only, MP3 audio, with download archive
yt-dlp -x --audio-format mp3 --audio-quality 0 \
  --playlist-start 10 --playlist-end 30 \
  --embed-thumbnail --write-thumbnail --embed-metadata \
  --download-archive ~/.yt-archive.txt \
  -o '~/Music/%(playlist_index)s - %(title).200B.%(ext)s' \
  --restrict-filenames --no-overwrites --continue --ignore-errors \
  'https://www.youtube.com/playlist?list=PLxxxxxx'
```

> Always check your local laws and YouTube's Terms of Service before downloading content. The extension does not perform downloads itself.

---

## 🌐 Browser compatibility

| Browser | Status |
| --- | --- |
| Brave (Chromium-based) | ✅ Tested target |
| Google Chrome | ✅ Tested target |
| Microsoft Edge | ✅ Should work — same MV3 runtime |
| Opera / Vivaldi | ✅ Should work — same MV3 runtime |
| Firefox | ⚠ Not supported as-is (uses `chrome.*` MV3; would need `browser.*` shims) |

---

## ⚠ Limitations

- **Without an API key**, only videos rendered in the YouTube playlist side panel are seen. YouTube lazy-loads long playlists, so totals may be partial. The duration tab will tell you the source.
- The sentiment analyzer is a **lexicon-based** approach (a curated AFINN/VADER-style word list with negation, intensifiers and diminishers). It is fast and offline, but not as nuanced as a transformer. Results are best read as trends, not absolutes.
- Sarcasm, non-English comments, and emoji-only comments are not well captured.
- YouTube's DOM and selectors can change. The extension uses several selector fallbacks to stay robust, but page-DOM scraping is inherently best-effort.

---

## 🛠 Development notes

```
yt-playlist-analyzer/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js          ← orchestrator
├── content/
│   └── content.js        ← runs on youtube.com, scrapes DOM
├── background/
│   └── service-worker.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
├── utils/
│   ├── duration.js       ← ISO-8601 + clock parsing
│   ├── youtube-api.js    ← Data API v3 wrapper
│   ├── sentiment.js      ← lexicon-based analyzer
│   ├── topics.js         ← n-gram frequency
│   └── ytdlp.js          ← command builder
├── assets/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md
└── HOW_TO_USE.md
```

- Pure ES modules, vanilla JS — no build step.
- All utilities (`utils/*.js`) have no DOM dependencies and can be unit-tested in any JS environment.
- `popup.js` is the only file that touches the DOM and `chrome.*` APIs.
- The sentiment lexicon is embedded directly in `utils/sentiment.js` so the extension has zero runtime dependencies.

### Tweaks you may want

- **Add languages to the sentiment lexicon:** edit the `POSITIVE` / `NEGATIVE` maps in `utils/sentiment.js`.
- **Change the accent color:** override `--accent` and `--accent-soft` in `popup/popup.css`.
- **Add new yt-dlp options:** extend `buildYtdlpCommand` in `utils/ytdlp.js` and add a control to `popup/popup.html`.

---

## 📜 License

MIT. Use it, fork it, ship it.
