// ── Configuration ────────────────────────────────────────────────

const BACKCHANNEL_WORDS = new Set([
  "mhm","mm-hmm","mmhmm","mm","hmm","hm",
  "yeah","yep","yes","yea",
  "ok","okay",
  "uh-huh","uh huh","uhuh",
  "right","sure","hi",
  "no","nah",
  "um","uh","oh","ah",
]);

const MAX_BACKCHANNEL_WORDS = 4;

// ── Helpers ──────────────────────────────────────────────────────

function tsToSeconds(ts) {
  const [h, m, rest] = ts.trim().split(":");
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(rest);
}

function tsDisplay(ts) {
  const [h, m, rest] = ts.trim().split(":");
  const s = Math.floor(parseFloat(rest));
  return `[${String(parseInt(h)).padStart(2,"0")}:${String(parseInt(m)).padStart(2,"0")}:${String(s).padStart(2,"0")}]`;
}

function simplifyName(full) {
  let name = full.replace(/\s*\([^)]*\)/g, "").trim();
  if (name.includes(",")) {
    return name.split(",", 2)[1].trim();
  }
  return name;
}

function isBackchannel(text) {
  const words = text.toLowerCase().replace(/[.,!?;:\-''\"]+/g, " ").trim().split(/\s+/);
  if (!words.length || words[0] === "" || words.length > MAX_BACKCHANNEL_WORDS) return false;
  return words.every(w => BACKCHANNEL_WORDS.has(w));
}

function cleanText(text) {
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/\s+([.,!?;:])/g, "$1");
  return text;
}

// ── Helpers (docx timestamps) ────────────────────────────────────

function docxTsToSeconds(ts) {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function docxTsDisplay(ts) {
  const totalSec = docxTsToSeconds(ts);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `[${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}]`;
}

// ── Parsing ──────────────────────────────────────────────────────

async function parseDocx(file) {
  const zip = await JSZip.loadAsync(file);
  const xml = await zip.file("word/document.xml").async("string");

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const nsW = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const paragraphs = doc.getElementsByTagNameNS(nsW, "p");

  const segments = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const runs = p.getElementsByTagNameNS(nsW, "r");

    let speaker = "";
    let timestamp = "";
    const textParts = [];

    for (let j = 0; j < runs.length; j++) {
      const r = runs[j];
      const tNodes = r.getElementsByTagNameNS(nsW, "t");
      if (!tNodes.length) continue;
      const text = tNodes[0].textContent || "";

      const rPr = r.getElementsByTagNameNS(nsW, "rPr")[0];
      if (!rPr) continue;
      const colorEl = rPr.getElementsByTagNameNS(nsW, "color")[0];
      if (!colorEl) continue;
      const color = colorEl.getAttribute("w:val");

      if (color === "5A5A71") {
        speaker += text;
      } else if (color === "a19f9d") {
        timestamp = text;
      } else if (color === "232330") {
        textParts.push(text);
      }
    }

    speaker = speaker.trim();
    const body = textParts.join(" ").trim();

    if (!body || !timestamp || timestamp === "stopped transcription") continue;

    segments.push({
      startSeconds: docxTsToSeconds(timestamp),
      startDisplay: docxTsDisplay(timestamp),
      speaker: speaker ? simplifyName(speaker) : "Unknown",
      text: body,
    });
  }

  return segments;
}

function parseVtt(text) {
  // Normalize line endings (handles \r\n, \r, and \n)
  text = text.replace(/\r\n?/g, "\n");

  const segments = [];
  const blocks = text.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split(/\n/);
    const tsIdx = lines.findIndex(l => l.includes("-->"));
    if (tsIdx === -1) continue;

    const tsMatch = lines[tsIdx].match(
      /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/
    );
    if (!tsMatch) continue;

    const raw = lines.slice(tsIdx + 1).join(" ").trim();
    if (!raw) continue;

    const speakerMatch = raw.match(/<v\s+([^>]+)>/);
    const speaker = speakerMatch ? simplifyName(speakerMatch[1]) : "Unknown";
    const body = raw.replace(/<\/?v[^>]*>/g, "").trim();
    if (!body) continue;

    segments.push({
      startSeconds: tsToSeconds(tsMatch[1]),
      startDisplay: tsDisplay(tsMatch[1]),
      speaker,
      text: body,
    });
  }

  segments.sort((a, b) => a.startSeconds - b.startSeconds);
  return segments;
}

// ── Backchannel removal ──────────────────────────────────────────

function removeBackchannels(segments) {
  const keep = new Array(segments.length).fill(true);

  for (let i = 0; i < segments.length; i++) {
    if (!isBackchannel(segments[i].text)) continue;

    let prevSpeaker = null;
    for (let j = i - 1; j >= 0; j--) {
      if (!isBackchannel(segments[j].text)) { prevSpeaker = segments[j].speaker; break; }
    }

    let nextSpeaker = null;
    for (let j = i + 1; j < segments.length; j++) {
      if (!isBackchannel(segments[j].text)) { nextSpeaker = segments[j].speaker; break; }
    }

    if (prevSpeaker && nextSpeaker &&
        prevSpeaker === nextSpeaker &&
        prevSpeaker !== segments[i].speaker) {
      keep[i] = false;
    }
  }

  return segments.filter((_, i) => keep[i]);
}

// ── Consolidation ────────────────────────────────────────────────

function consolidate(segments, dropBackchannels) {
  if (dropBackchannels) {
    segments = removeBackchannels(segments);
  }

  const merged = [];
  for (const seg of segments) {
    if (merged.length && merged[merged.length - 1].speaker === seg.speaker) {
      merged[merged.length - 1].text += " " + seg.text;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

// ── Convert ──────────────────────────────────────────────────────

function convertFromSegments(segments, dropBackchannels = true) {
  const merged = consolidate(segments, dropBackchannels);
  return merged.map(s => `${s.startDisplay} ${s.speaker}: ${cleanText(s.text)}`).join("\n\n");
}

function convert(vttText, dropBackchannels = true) {
  const segments = parseVtt(vttText);
  return convertFromSegments(segments, dropBackchannels);
}

async function convertDocx(file, dropBackchannels = true) {
  const segments = await parseDocx(file);
  return convertFromSegments(segments, dropBackchannels);
}

// ── UI ───────────────────────────────────────────────────────────

const dropZone    = document.getElementById("dropZone");
const fileInput   = document.getElementById("fileInput");
const fileListEl  = document.getElementById("fileList");
const convertBtn  = document.getElementById("convertBtn");
const resultsEl   = document.getElementById("results");
const bcToggle    = document.getElementById("backchannelToggle");

let pendingFiles = [];

function isSupportedFile(name) {
  const lower = name.toLowerCase();
  return lower.endsWith(".vtt") || lower.endsWith(".docx");
}

function addFiles(newFiles) {
  for (const f of newFiles) {
    if (!isSupportedFile(f.name)) continue;
    if (pendingFiles.some(p => p.name === f.name && p.size === f.size)) continue;
    pendingFiles.push(f);
  }
  renderFileList();
}

function removeFile(index) {
  pendingFiles.splice(index, 1);
  renderFileList();
}

function renderFileList() {
  fileListEl.innerHTML = "";
  for (let i = 0; i < pendingFiles.length; i++) {
    const div = document.createElement("div");
    div.className = "file-item";
    div.innerHTML = `
      <span class="name">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span>${escapeHtml(pendingFiles[i].name)}</span>
      </span>
      <button class="remove-btn" data-idx="${i}" aria-label="Remove ${escapeHtml(pendingFiles[i].name)}">&times;</button>
    `;
    fileListEl.appendChild(div);
  }

  fileListEl.querySelectorAll(".remove-btn").forEach(btn => {
    btn.addEventListener("click", () => removeFile(parseInt(btn.dataset.idx)));
  });

  convertBtn.classList.toggle("hidden", pendingFiles.length === 0);
  if (pendingFiles.length === 0) resultsEl.classList.add("hidden");
}

// Drag & drop
dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  addFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", () => { addFiles(fileInput.files); fileInput.value = ""; });

// Convert
convertBtn.addEventListener("click", async () => {
  convertBtn.disabled = true;
  convertBtn.textContent = "Converting\u2026";
  resultsEl.innerHTML = "";
  resultsEl.classList.remove("hidden");

  const dropBc = bcToggle.checked;
  const outputs = [];

  for (const file of pendingFiles) {
    let result;
    if (file.name.toLowerCase().endsWith(".docx")) {
      result = await convertDocx(file, dropBc);
    } else {
      const text = await file.text();
      result = convert(text, dropBc);
    }
    const outName = file.name.replace(/\.(vtt|docx)$/i, "_clean.txt");
    outputs.push({ name: outName, content: result });

    const card = document.createElement("div");
    card.className = "result-card";

    const preview = result.length > 2000 ? result.slice(0, 2000) + "\n\u2026" : result;

    card.innerHTML = `
      <div class="result-header">
        <h3>
          <svg class="check-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ${escapeHtml(outName)}
        </h3>
        <button class="download-btn" data-idx="${outputs.length - 1}" aria-label="Download ${escapeHtml(outName)}">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download
        </button>
      </div>
      <div class="result-preview">${escapeHtml(preview)}</div>
    `;
    resultsEl.appendChild(card);
  }

  if (outputs.length > 1) {
    const allBtn = document.createElement("button");
    allBtn.className = "download-all-btn";
    allBtn.setAttribute("aria-label", "Download all converted files");
    allBtn.innerHTML = `
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Download all
    `;
    allBtn.addEventListener("click", () => outputs.forEach(o => downloadFile(o.name, o.content)));
    resultsEl.appendChild(allBtn);
  }

  resultsEl.querySelectorAll(".download-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const o = outputs[parseInt(btn.dataset.idx)];
      downloadFile(o.name, o.content);
    });
  });

  convertBtn.disabled = false;
  convertBtn.textContent = "Convert";
});

function downloadFile(name, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
