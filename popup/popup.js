// Popup orchestration. Loads playlist info from the active tab, fetches data via
// the YouTube Data API when an API key is available, and falls back to the DOM
// data scraped by the content script otherwise.

import { summarizeDuration, formatSeconds, formatClock } from "../utils/duration.js";
import {
  hasApiKey,
  fetchPlaylistMeta,
  fetchPlaylistItems,
  fetchVideoDetails,
  fetchVideoComments
} from "../utils/youtube-api.js";
import { analyzeBatch } from "../utils/sentiment.js";
import { summarizeTopics } from "../utils/topics.js";
import { buildYtdlpCommand } from "../utils/ytdlp.js";

// ---- App state ------------------------------------------------------------
const state = {
  playlist: null,         // { id, title, channel, url, itemCount }
  videos: [],             // [{ videoId, title, durationSec, likes?, views?, channel? }]
  source: "unknown",      // "api" | "dom"
  hasApi: false,
  range: { from: 1, to: 1 },
  stats: null,
  sentiment: null,
  topics: null
};

// ---- DOM helpers ----------------------------------------------------------
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function show(el) { el?.classList.remove("hidden"); }
function hide(el) { el?.classList.add("hidden"); }

function setText(sel, text) {
  const el = typeof sel === "string" ? $(sel) : sel;
  if (el) el.textContent = text;
}

function showError(boxSel, message) {
  const box = $(boxSel);
  if (!box) return;
  box.textContent = message;
  show(box);
}

// ---- Init -----------------------------------------------------------------
document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindStaticUI();
  state.hasApi = await hasApiKey();
  setText("#api-status", state.hasApi ? "API key present — full mode" : "No API key — limited mode");

  await loadPlaylistFromActiveTab();
}

function bindStaticUI() {
  $("#open-options")?.addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("#open-options-stats")?.addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("#open-options-sent")?.addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("#btn-refresh")?.addEventListener("click", () => loadPlaylistFromActiveTab(true));

  $$(".tab").forEach(tab => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  $("#range-apply")?.addEventListener("click", applyRange);
  $("#btn-load-stats")?.addEventListener("click", loadStats);
  $("#btn-load-sentiment")?.addEventListener("click", loadSentiment);

  // yt-dlp form
  ["yt-format", "yt-platform", "yt-start", "yt-end", "yt-out", "yt-template",
    "yt-thumbnail", "yt-metadata", "yt-subs", "yt-autosubs", "yt-comments",
    "yt-info", "yt-desc", "yt-sublangs", "yt-archive"
  ].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.addEventListener("input", updateYtdlpCommand);
    if (el) el.addEventListener("change", updateYtdlpCommand);
  });
  $("#yt-copy")?.addEventListener("click", copyYtdlpCommand);
}

function switchTab(name) {
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  $$(".panel").forEach(p => p.classList.toggle("active", p.dataset.panel === name));
  if (name === "topics" && !state.topics) renderTopics();
  if (name === "ytdlp") updateYtdlpCommand();
}

// ---- Playlist loading -----------------------------------------------------
async function loadPlaylistFromActiveTab(force = false) {
  hide($("#state-loaded"));
  hide($("#state-empty"));
  show($("#duration-loading"));
  setText("#duration-progress", "Detecting playlist…");

  let info = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/youtube\.com/.test(tab.url)) {
      hide($("#duration-loading"));
      show($("#state-empty"));
      return;
    }
    // Try messaging first; only inject the content script if no listener exists.
    try {
      info = await chrome.tabs.sendMessage(tab.id, { type: "GET_PLAYLIST_INFO" });
    } catch (msgErr) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/content.js"]
        });
        info = await chrome.tabs.sendMessage(tab.id, { type: "GET_PLAYLIST_INFO" });
      } catch (injErr) {
        hide($("#duration-loading"));
        show($("#state-empty"));
        return;
      }
    }
  } catch (e) {
    hide($("#duration-loading"));
    show($("#state-empty"));
    return;
  }

  if (!info || !info.found) {
    hide($("#duration-loading"));
    show($("#state-empty"));
    return;
  }

  show($("#state-loaded"));
  setText("#pl-title", info.title || "Untitled playlist");
  setText("#pl-channel", "—");
  setText("#pl-count", "…");

  // Try API path first if we have a key.
  state.hasApi = await hasApiKey();
  setText("#api-status", state.hasApi ? "API key present — full mode" : "No API key — limited mode");

  let videos = [];
  let meta = null;
  let source = "dom";

  if (state.hasApi) {
    try {
      setText("#duration-progress", "Fetching playlist via YouTube API…");
      meta = await fetchPlaylistMeta(info.playlistId);
      const items = await fetchPlaylistItems(info.playlistId, p => {
        setText("#duration-progress", `Fetching playlist items (page ${p.page}, ${p.count} so far)…`);
      });
      const ids = items.map(i => i.videoId).filter(Boolean);
      const details = await fetchVideoDetails(ids, p => {
        setText("#duration-progress", `Fetching video details (${p.done}/${p.total})…`);
      });
      const detailMap = new Map(details.map(d => [d.videoId, d]));
      videos = items.map((it, idx) => {
        const d = detailMap.get(it.videoId) || {};
        return {
          videoId: it.videoId,
          title: it.title || d.title || "",
          channel: it.channel || d.channel || "",
          durationSec: d.durationSec || 0,
          views: d.views ?? null,
          likes: d.likes ?? null,
          comments: d.comments ?? null,
          position: idx
        };
      });
      source = "api";
    } catch (e) {
      console.warn("API path failed, falling back to DOM:", e);
      videos = info.videos || [];
      source = "dom";
      showError("#duration-error",
        `YouTube API failed: ${e.message}\nFalling back to DOM-scraped data (visible videos only).`);
    }
  } else {
    videos = info.videos || [];
    source = "dom";
  }

  state.playlist = {
    id: info.playlistId,
    title: meta?.title || info.title,
    channel: meta?.channel || (videos[0]?.channel || ""),
    url: info.url,
    itemCount: meta?.itemCount ?? videos.length
  };
  state.videos = videos;
  state.source = source;
  state.range = { from: 1, to: videos.length || 1 };
  state.stats = null;
  state.sentiment = null;
  state.topics = null;

  setText("#pl-title", state.playlist.title);
  setText("#pl-channel", state.playlist.channel || "—");
  setText("#pl-count", String(state.playlist.itemCount));

  hide($("#duration-loading"));
  renderDuration();
  renderTopics();
  refreshGatedTabs();
  updateYtdlpCommand();
}

// ---- DURATION TAB ---------------------------------------------------------
function renderDuration() {
  show($("#duration-content"));
  const total = state.videos.reduce((s, v) => s + (v.durationSec || 0), 0);
  const totalSummary = summarizeDuration(total);
  setText("#m-total", `${totalSummary.pretty} (${formatClock(total)})`);

  $("#range-from").max = state.videos.length;
  $("#range-to").max = state.videos.length;
  $("#range-from").value = "1";
  $("#range-to").value = String(state.videos.length || 1);

  const known = state.videos.filter(v => v.durationSec > 0).length;
  const sourceMsg = state.source === "api"
    ? `Source: YouTube Data API · ${state.videos.length} videos · durations known for ${known}.`
    : `Source: page DOM (limited) · ${state.videos.length} videos visible · durations known for ${known}. Add an API key in settings for the full playlist.`;
  setText("#duration-source", sourceMsg);

  applyRange();
}

function applyRange() {
  let from = parseInt($("#range-from").value, 10) || 1;
  let to = parseInt($("#range-to").value, 10) || state.videos.length;
  from = Math.max(1, Math.min(from, state.videos.length));
  to = Math.max(from, Math.min(to, state.videos.length));
  $("#range-from").value = String(from);
  $("#range-to").value = String(to);
  state.range = { from, to };

  const slice = state.videos.slice(from - 1, to);
  const total = slice.reduce((s, v) => s + (v.durationSec || 0), 0);
  const summary = summarizeDuration(total);

  setText("#m-range", `${summary.pretty} (${formatClock(total)})`);
  setText("#m-range-count", `${slice.length} video${slice.length === 1 ? "" : "s"}`);
  const avg = slice.length ? total / slice.length : 0;
  setText("#m-avg", formatSeconds(avg));

  const watchList = $("#watch-list");
  watchList.innerHTML = "";
  for (const [label, value] of [
    ["@1.0× (normal)", summary.pretty],
    ["@1.25×", summary.watchAt125],
    ["@1.5×", summary.watchAt150],
    ["@1.75×", summary.watchAt175],
    ["@2.0×", summary.watchAt200]
  ]) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${label}</span><b>${value}</b>`;
    watchList.appendChild(li);
  }

  // When range changes the yt-dlp tab should reflect new bounds.
  $("#yt-start").placeholder = `1 (default)`;
  $("#yt-end").placeholder = `${state.videos.length} (default)`;
  updateYtdlpCommand();
}

// ---- STATS TAB ------------------------------------------------------------
function refreshGatedTabs() {
  if (state.hasApi && state.source === "api") {
    hide($("#stats-empty"));
    hide($("#sent-empty"));
    $("#btn-load-stats").disabled = false;
    $("#btn-load-sentiment").disabled = false;
  } else {
    show($("#stats-empty"));
    show($("#sent-empty"));
    $("#btn-load-stats").disabled = true;
    $("#btn-load-sentiment").disabled = true;
  }
}

async function loadStats() {
  if (!state.videos.length) return;
  hide($("#stats-error"));
  show($("#stats-loading"));
  hide($("#stats-content"));

  try {
    // Stats already came in with fetchVideoDetails when API path was used.
    const withLikes = state.videos.filter(v => v.likes != null);
    const totalLikes = withLikes.reduce((s, v) => s + v.likes, 0);
    const totalViews = state.videos.reduce((s, v) => s + (v.views || 0), 0);
    const avgLikes = withLikes.length ? totalLikes / withLikes.length : 0;
    const ratio = totalViews ? (totalLikes / totalViews) * 100 : 0;

    let most = null, least = null;
    for (const v of withLikes) {
      if (!most || v.likes > most.likes) most = v;
      if (!least || v.likes < least.likes) least = v;
    }

    setText("#s-total-likes", formatNumber(totalLikes));
    setText("#s-total-views", formatNumber(totalViews));
    setText("#s-avg-likes", formatNumber(Math.round(avgLikes)));
    setText("#s-ratio", `${ratio.toFixed(2)}%`);
    setText("#s-most", most ? `${formatNumber(most.likes)} 👍 — ${truncate(most.title, 60)}` : "—");
    setText("#s-least", least ? `${formatNumber(least.likes)} 👍 — ${truncate(least.title, 60)}` : "—");

    state.stats = { totalLikes, totalViews, avgLikes, ratio, most, least };
    show($("#stats-content"));
  } catch (e) {
    showError("#stats-error", `Failed: ${e.message}`);
  } finally {
    hide($("#stats-loading"));
  }
}

// ---- SENTIMENT TAB --------------------------------------------------------
async function loadSentiment() {
  if (!state.videos.length) return;
  hide($("#sent-error"));
  hide($("#sent-content"));
  show($("#sent-loading"));
  setText("#sent-progress", "Fetching comments…");
  $("#btn-load-sentiment").disabled = true;

  try {
    const perVideo = clamp(parseInt($("#sent-per-video").value, 10) || 25, 5, 100);
    const maxVideos = clamp(parseInt($("#sent-max-videos").value, 10) || 10, 1, 50);

    // Pick top N videos with the most comments (or first N if comment count unknown).
    const candidates = state.videos
      .filter(v => v.videoId)
      .slice()
      .sort((a, b) => (b.comments ?? 0) - (a.comments ?? 0))
      .slice(0, maxVideos);

    const allComments = [];
    for (let i = 0; i < candidates.length; i++) {
      setText("#sent-progress", `Fetching comments (${i + 1}/${candidates.length})…`);
      const comments = await fetchVideoComments(candidates[i].videoId, perVideo);
      allComments.push(...comments);
    }

    if (allComments.length === 0) {
      throw new Error("No comments could be fetched (they may be disabled).");
    }

    setText("#sent-progress", `Analyzing ${allComments.length} comments…`);
    const summary = await analyzeBatch(allComments, 25, p => {
      setText("#sent-progress", `Analyzing comments (${p.done}/${p.total})…`);
    });

    state.sentiment = summary;
    renderSentiment(summary);
    show($("#sent-content"));
  } catch (e) {
    showError("#sent-error", e.message || String(e));
  } finally {
    hide($("#sent-loading"));
    $("#btn-load-sentiment").disabled = false;
  }
}

function renderSentiment(s) {
  $("#bar-pos").style.flex = String(Math.max(s.positivePct, 0.001));
  $("#bar-neu").style.flex = String(Math.max(s.neutralPct, 0.001));
  $("#bar-neg").style.flex = String(Math.max(s.negativePct, 0.001));
  setText("#pct-pos", `${s.positivePct}%`);
  setText("#pct-neu", `${s.neutralPct}%`);
  setText("#pct-neg", `${s.negativePct}%`);

  const overallEl = $("#sent-overall");
  overallEl.textContent = s.overall;
  overallEl.className = `badge ${s.overall}`;
  setText("#sent-avg", String(s.averageScore));
  setText("#sent-total", String(s.total));

  const renderChips = (ul, items) => {
    ul.innerHTML = "";
    if (!items.length) {
      const li = document.createElement("li");
      li.textContent = "—";
      ul.appendChild(li);
      return;
    }
    for (const it of items) {
      const li = document.createElement("li");
      li.innerHTML = `${it.word}<b>×${it.count}</b>`;
      ul.appendChild(li);
    }
  };
  renderChips($("#theme-pos"), s.topPositiveWords);
  renderChips($("#theme-neg"), s.topNegativeWords);
}

// ---- TOPICS TAB -----------------------------------------------------------
function renderTopics() {
  hide($("#topics-error"));
  if (!state.videos.length) {
    setText("#topics-meta", "No videos to summarize.");
    show($("#topics-content"));
    return;
  }
  const titles = state.videos.map(v => v.title).filter(Boolean);
  const result = summarizeTopics(titles, { maxTopics: 8 });
  state.topics = result;

  const ul = $("#topics-list");
  ul.innerHTML = "";
  if (!result.topics.length) {
    const li = document.createElement("li");
    li.textContent = "Could not detect distinct topics from titles.";
    ul.appendChild(li);
  } else {
    for (const t of result.topics) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${escapeHtml(t.topic)}</span><span class="topic-coverage">${t.count}× · ${t.coverage}%</span>`;
      ul.appendChild(li);
    }
  }
  setText("#topics-meta",
    `Based on ${result.titleCount} titles · ${result.keywordCount} unique keywords analyzed.`);
  show($("#topics-content"));
}

// ---- YT-DLP TAB -----------------------------------------------------------
function readYtdlpForm() {
  // Always use the canonical playlist URL so yt-dlp doesn't pick up a single
  // video from a /watch?v=X&list=... URL.
  const playlistUrl = state.playlist?.id
    ? `https://www.youtube.com/playlist?list=${state.playlist.id}`
    : (state.playlist?.url || "");
  return {
    url: playlistUrl,
    format: $("#yt-format").value,
    platform: $("#yt-platform").value,
    start: $("#yt-start").value,
    end: $("#yt-end").value,
    outputDir: $("#yt-out").value,
    filenameTemplate: $("#yt-template").value,
    thumbnail: $("#yt-thumbnail").checked,
    metadata: $("#yt-metadata").checked,
    subtitles: $("#yt-subs").checked,
    autoSubs: $("#yt-autosubs").checked,
    comments: $("#yt-comments").checked,
    writeInfoJson: $("#yt-info").checked,
    writeDescription: $("#yt-desc").checked,
    subLangs: $("#yt-sublangs").value,
    archive: $("#yt-archive").value
  };
}

function updateYtdlpCommand() {
  const opts = readYtdlpForm();
  if (!opts.url) {
    $("#yt-cmd").textContent = "# Open a playlist on YouTube first.";
    return;
  }
  const cmd = buildYtdlpCommand(opts);
  $("#yt-cmd").textContent = cmd;
}

async function copyYtdlpCommand() {
  const text = $("#yt-cmd").textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const btn = $("#yt-copy");
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = orig; }, 1200);
  } catch (e) {
    // Clipboard API can fail in restricted contexts; provide a manual fallback.
    const range = document.createRange();
    range.selectNode($("#yt-cmd"));
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);
  }
}

// ---- helpers --------------------------------------------------------------
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function truncate(s, n) { return !s ? "—" : (s.length > n ? s.slice(0, n - 1) + "…" : s); }
function formatNumber(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString();
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
