# How to Use — YouTube Playlist Analyzer

A 5-minute walk-through for first-time users.

---

## 1. Install the extension

1. Download the `yt-playlist-analyzer` folder (or clone the repo).
2. Open your browser:
   - In **Brave**, go to `brave://extensions`.
   - In **Chrome**, go to `chrome://extensions`.
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the `yt-playlist-analyzer` folder (the one containing `manifest.json`).
6. The pink ▶ icon now lives in your toolbar. Click the puzzle-piece icon and pin it.

---

## 2. Open a YouTube playlist

Either:
- Go to a playlist page directly, e.g. `https://www.youtube.com/playlist?list=PLxxxx`, **or**
- Open any video that is part of a playlist (the URL will contain `&list=PLxxxx`).

Then click the pink ▶ extension icon.

---

## 3. The five tabs

### 🕒 Duration
- Shows the **total runtime** of the playlist.
- Use the **From / To** boxes to pick a range (e.g. videos 10–30) and click **Apply**.
- See estimated watch times at 1.25×, 1.5×, 1.75× and 2× playback speed.

### 📊 Stats *(needs an API key — see step 5)*
- Total likes, total views, average likes, like-to-view ratio.
- Most liked & least liked videos in the playlist.

### 💬 Sentiment *(needs an API key — see step 5)*
- Tweak **Comments per video** (default 25) and **Max videos to scan** (default 10).
- Click **Analyze comments**.
- You get positive / neutral / negative percentages, an overall badge, and the most common positive / negative words.

### 🏷 Topics
- Always available. Reads every video title in the playlist and groups them by frequent keywords and phrases.
- Output: "This playlist mainly covers: …"

### ⬇ yt-dlp
- Choose **format** (best video, 1080p, 720p, audio MP3, etc.).
- Pick **macOS / Linux** or **Windows** .
- (Optional) Set a **range** with Start # / End #.
- (Optional) Set **output folder**, filename template, embed thumbnail/metadata, subtitles, comments, etc.
- The command updates **live** at the bottom. Click **Copy command** and paste it into your terminal.

---

## 4. Install yt-dlp on your computer (one-time)

Pick the line for your OS:

```bash
# macOS
brew install yt-dlp ffmpeg

# Linux (Debian/Ubuntu)
sudo apt install yt-dlp ffmpeg

# Windows (PowerShell)
winget install yt-dlp
winget install Gyan.FFmpeg
```

`ffmpeg` is needed when you embed thumbnails / metadata / subtitles or extract audio.

### Example commands

```bash
# Best 1080p, whole playlist (Linux/macOS)
yt-dlp -f 'bestvideo[height<=1080]+bestaudio/best[height<=1080]' \
  --embed-thumbnail --embed-metadata \
  -o '~/Videos/MyPlaylist/%(playlist_index)s - %(title)s.%(ext)s' \
  'https://www.youtube.com/playlist?list=PLxxxx'

# Audio only, MP3, videos 10–30
yt-dlp -x --audio-format mp3 --audio-quality 0 \
  --playlist-start 10 --playlist-end 30 \
  -o '~/Music/%(title)s.%(ext)s' \
  'https://www.youtube.com/playlist?list=PLxxxx'
```

You don't have to memorize any of this — the extension generates the exact line for you.

---

## 5. (Optional) Unlock full mode with a free YouTube API key

Stats and sentiment use the YouTube Data API. The free tier is more than enough for personal use.

1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/).
2. Create or pick a project.
3. **APIs & Services → Library** → search **YouTube Data API v3** → **Enable**.
4. **APIs & Services → Credentials** → **Create credentials → API key**.
5. Copy the key.
6. In the extension, click ⚙ (top-right of the popup) → paste the key → **Save**.

The key lives only in your browser. Reopen the popup — the footer should now read **"API key present — full mode"**.

---

## 6. Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Open a YouTube playlist" empty state on a playlist page | Refresh the YouTube tab, then click the extension again. |
| "YouTube API failed: 403" | Make sure the YouTube Data API v3 is enabled for your Google Cloud project. |
| "YouTube API failed: 400" | Re-check the API key in settings — no extra spaces. |
| Sentiment shows "No comments could be fetched" | The videos likely have comments disabled, or your daily quota is used. |
| Duration looks too small | Without an API key only the videos visible in the side panel are counted — scroll the playlist or add a key. |

That's it. Enjoy your playlist analytics.
