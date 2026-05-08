import { getApiKey, setApiKey } from "../utils/youtube-api.js";

const $ = sel => document.querySelector(sel);

async function load() {
  const key = await getApiKey();
  if (key) $("#api-key").value = key;
  $("#ver").textContent = chrome.runtime.getManifest().version;
}

async function save() {
  const key = $("#api-key").value.trim();
  await setApiKey(key);
  const status = $("#status");
  if (key) {
    status.textContent = "Saved. Reopen the popup to refresh data.";
    status.className = "status ok";
  } else {
    status.textContent = "API key cleared. Limited mode is now active.";
    status.className = "status";
  }
  setTimeout(() => {
    status.textContent = "";
    status.className = "status muted";
  }, 4000);
}

document.addEventListener("DOMContentLoaded", load);
$("#save").addEventListener("click", save);
$("#api-key").addEventListener("keydown", e => {
  if (e.key === "Enter") save();
});
