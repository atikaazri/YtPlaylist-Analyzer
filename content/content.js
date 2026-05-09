// Content script: runs on youtube.com pages and answers messages from the popup.
// - "GET_PLAYLIST_INFO": returns playlist id/title/url and a DOM-scraped video list.
//
// DOM scraping is a fallback path (works without an API key) but is limited to the
// videos YouTube has rendered in the side panel. For complete playlist data, the
// popup uses the YouTube Data API instead.

function getPlaylistIdFromUrl(url) {
  try {
    const u = new URL(url);
    const list = u.searchParams.get("list");
    return list || "";
  } catch {
    return "";
  }
}

function parseClock(text) {
  if (!text) return 0;
  const cleaned = String(text).trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(cleaned)) return 0;
  const parts = cleaned.split(":").map(n => parseInt(n, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function getPlaylistTitle() {
  const candidates = [
    "ytd-playlist-panel-renderer #header-description #title",
    "ytd-playlist-panel-renderer h3 a",
    "ytd-playlist-header-renderer yt-dynamic-sizing-formatted-string",
    "ytd-playlist-header-renderer .title",
    "ytd-playlist-byline-renderer + h1",
    "h1.ytd-playlist-header-renderer",
    "yt-formatted-string#title"
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim()) return el.textContent.trim();
  }
  // Document title strip
  const docTitle = document.title.replace(/\s*-\s*YouTube\s*$/i, "").trim();
  return docTitle || "Untitled playlist";
}

// Pick the DOM container(s) that actually hold this playlist's items.
// Avoids picking up: search-result playlist previews, recommendation rails,
// autoplay queues, or stale SPA-cached panels for other playlists.
function pickScopes(playlistId) {
  const scopes = [];

  if (location.pathname.startsWith("/playlist")) {
    // Full playlist page: items live inside ytd-playlist-video-list-renderer.
    document.querySelectorAll("ytd-playlist-video-list-renderer").forEach(el => scopes.push(el));
  } else {
    // Watch page: items live inside the side panel.
    // Match the panel whose playlist-id attribute equals the current playlistId,
    // since YouTube can keep multiple panels in the DOM (SPA caching).
    document.querySelectorAll("ytd-playlist-panel-renderer").forEach(el => {
      const pid =
        el.getAttribute("playlist-id") ||
        el.getAttribute("data-playlist-id") ||
        "";
      if (!pid || pid === playlistId) scopes.push(el);
    });
  }

  // No scoped container found — fall back to whole document, but the per-item
  // URL filter below will still drop anything that isn't part of this playlist.
  if (!scopes.length) scopes.push(document);
  return scopes;
}

function scrapeVideosFromPanel(playlistId) {
  const scopes = pickScopes(playlistId);
  const itemSelector = "ytd-playlist-panel-video-renderer, ytd-playlist-video-renderer";
  const seen = new Set();
  const videos = [];
  let position = 0;

  for (const scope of scopes) {
    const items = scope.querySelectorAll(itemSelector);
    items.forEach(el => {
      const linkEl = el.querySelector("a#wc-endpoint, a#video-title, a.yt-simple-endpoint");
      const href = linkEl?.href || "";

      let videoId = "";
      let listId = "";
      try {
        if (href) {
          const u = new URL(href, location.origin);
          videoId = u.searchParams.get("v") || "";
          listId = u.searchParams.get("list") || "";
        }
      } catch {}

      // Strict gates:
      //   1) must have a real video id
      //   2) if the link carries a list= param, it must equal the current playlist
      //   3) drop duplicates (same video id seen via multiple matched scopes)
      if (!videoId) return;
      if (listId && listId !== playlistId) return;
      if (seen.has(videoId)) return;
      seen.add(videoId);

      const titleEl = el.querySelector(
        "a#wc-endpoint, a#video-title, #video-title, a.ytd-playlist-panel-video-renderer"
      );
      const timeEl = el.querySelector(
        "ytd-thumbnail-overlay-time-status-renderer span, .badge-shape-wiz__text, #text.ytd-thumbnail-overlay-time-status-renderer"
      );
      const channelEl = el.querySelector(
        "yt-formatted-string.ytd-channel-name, .ytd-channel-name a, #byline a"
      );

      const title = (titleEl?.title || titleEl?.textContent || "").trim();
      const durationText = (timeEl?.textContent || "").trim();
      const durationSec = parseClock(durationText);

      videos.push({
        videoId,
        title,
        channel: (channelEl?.textContent || "").trim(),
        durationSec,
        durationText,
        position: position++
      });
    });
  }

  return videos;
}

function getPlaylistInfo() {
  const playlistId = getPlaylistIdFromUrl(location.href);
  if (!playlistId) {
    return { found: false, reason: "No 'list' parameter in current URL." };
  }
  const title = getPlaylistTitle();
  const videos = scrapeVideosFromPanel(playlistId);
  return {
    found: true,
    playlistId,
    title,
    url: location.href,
    videos,
    pageType: location.pathname.startsWith("/playlist") ? "playlist" : "watch"
  };
}

// Idempotent: if this script gets injected twice (e.g. by both the manifest
// content_scripts entry and chrome.scripting.executeScript from the popup),
// register the message listener only once.
if (!window.__YT_PA_LOADED__) {
  window.__YT_PA_LOADED__ = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "GET_PLAYLIST_INFO") {
      try {
        sendResponse(getPlaylistInfo());
      } catch (e) {
        sendResponse({ found: false, reason: e.message || String(e) });
      }
      return true;
    }
    return false;
  });
}
