// YouTube Data API v3 wrapper. All calls are no-ops without an API key;
// callers must check hasApiKey() before requesting data that requires it.

import { parseISODuration } from "./duration.js";

const API_BASE = "https://www.googleapis.com/youtube/v3";

export async function getApiKey() {
  return new Promise(resolve => {
    chrome.storage.local.get(["ytApiKey"], result => {
      resolve(result.ytApiKey || "");
    });
  });
}

export async function setApiKey(key) {
  return new Promise(resolve => {
    chrome.storage.local.set({ ytApiKey: (key || "").trim() }, () => resolve());
  });
}

export async function hasApiKey() {
  const key = await getApiKey();
  return key.length > 0;
}

async function apiFetch(endpoint, params) {
  const key = await getApiKey();
  if (!key) throw new Error("NO_API_KEY");
  const url = new URL(`${API_BASE}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`YouTube API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// Fetch all playlistItems (paginated, 50 per page) for a playlist.
export async function fetchPlaylistItems(playlistId, onProgress) {
  const items = [];
  let pageToken = "";
  let page = 0;
  do {
    const data = await apiFetch("playlistItems", {
      part: "snippet,contentDetails",
      playlistId,
      maxResults: 50,
      pageToken
    });
    if (Array.isArray(data.items)) {
      for (const it of data.items) {
        items.push({
          videoId: it.contentDetails?.videoId,
          title: it.snippet?.title || "",
          channel: it.snippet?.videoOwnerChannelTitle || it.snippet?.channelTitle || "",
          position: it.snippet?.position ?? items.length,
          publishedAt: it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt || ""
        });
      }
    }
    page++;
    if (typeof onProgress === "function") onProgress({ stage: "playlistItems", page, count: items.length });
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return items.filter(v => v.videoId);
}

// Fetch playlist metadata (title, channel, totals).
export async function fetchPlaylistMeta(playlistId) {
  const data = await apiFetch("playlists", {
    part: "snippet,contentDetails",
    id: playlistId,
    maxResults: 1
  });
  const item = data.items?.[0];
  if (!item) return null;
  return {
    id: item.id,
    title: item.snippet?.title || "",
    channel: item.snippet?.channelTitle || "",
    description: item.snippet?.description || "",
    itemCount: item.contentDetails?.itemCount ?? 0
  };
}

// Fetch full video details (durations + statistics) in batches of 50.
export async function fetchVideoDetails(videoIds, onProgress) {
  const out = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await apiFetch("videos", {
      part: "contentDetails,statistics,snippet",
      id: batch.join(",")
    });
    if (Array.isArray(data.items)) {
      for (const v of data.items) {
        out.push({
          videoId: v.id,
          title: v.snippet?.title || "",
          channel: v.snippet?.channelTitle || "",
          durationSec: parseISODuration(v.contentDetails?.duration || ""),
          views: parseInt(v.statistics?.viewCount || "0", 10),
          likes: v.statistics?.likeCount != null ? parseInt(v.statistics.likeCount, 10) : null,
          comments: v.statistics?.commentCount != null ? parseInt(v.statistics.commentCount, 10) : null,
          publishedAt: v.snippet?.publishedAt || ""
        });
      }
    }
    if (typeof onProgress === "function") onProgress({ stage: "videoDetails", done: out.length, total: videoIds.length });
  }
  return out;
}

// Fetch top-level comments for a single video. Returns up to `max` plain text comments.
export async function fetchVideoComments(videoId, max = 50) {
  const out = [];
  let pageToken = "";
  try {
    while (out.length < max) {
      const data = await apiFetch("commentThreads", {
        part: "snippet",
        videoId,
        maxResults: Math.min(100, max - out.length),
        order: "relevance",
        textFormat: "plainText",
        pageToken
      });
      if (Array.isArray(data.items)) {
        for (const it of data.items) {
          const txt = it.snippet?.topLevelComment?.snippet?.textDisplay || "";
          if (txt) out.push(txt);
          if (out.length >= max) break;
        }
      }
      pageToken = data.nextPageToken || "";
      if (!pageToken) break;
    }
  } catch (e) {
    // Comments may be disabled on a video; treat as empty rather than failing the whole job.
    if (!String(e.message).includes("403")) throw e;
  }
  return out;
}
