# Transcript Cleaner

A browser-based tool that converts raw interview transcripts into clean, readable text. Built for UX researchers who need to quickly turn auto-generated transcripts into something they can actually work with.

**[Try it live](https://carlosalvareztr.github.io/web-vtt-docx-cleaner/)**

---

## What it does

Drop in a `.vtt` file or a Microsoft Teams `.docx` transcript and get back a clean `.txt` file with:

- **Speaker labels** — each turn is attributed to the correct participant
- **Timestamps** — every speaker turn starts with a `[HH:MM:SS]` marker
- **Merged turns** — consecutive segments from the same speaker are combined into one block
- **Backchannel removal** (optional) — strips out filler responses like *mhm*, *yeah*, *ok*, *uh-huh* that interrupt another speaker's turn

### Before

```
00:01:34.000 --> 00:01:38.000
<v User>Hi. Hello. Sorry I couldn't figure out the meeting link.

00:01:38.000 --> 00:01:39.500
<v Smith, Joe (TR Product)>Yeah.

00:01:39.500 --> 00:01:45.000
<v User>But I found it. Good. How are you?
```

### After

```
[00:01:34] User: Hi. Hello. Sorry I couldn't figure out the meeting link. But I found it. Good. How are you?
```

## Supported formats

| Format | Source | Details |
|--------|--------|---------|
| `.vtt` | WebVTT captions | Standard subtitle format from Zoom, Teams, and other platforms |
| `.docx` | Microsoft Teams | The Word document Teams generates from a meeting recording |

## Privacy & Security

This tool is designed to handle sensitive research data safely. **Your files never leave your device.**

- **No uploads** — transcript files are read directly by your browser using the [File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API). Nothing is sent to a server.
- **No backend** — the site is purely static HTML, CSS, and JavaScript. There is no server-side code, no database, and no analytics.
- **No external network calls** — the only external resource loaded is the [JSZip](https://stuk.github.io/jszip/) library (used to unpack `.docx` files client-side). Once the page loads, the tool works fully offline.
- **All processing in-memory** — file parsing, backchannel removal, speaker merging, and text cleaning all happen in your browser's memory. The cleaned output is generated as a local download via `Blob` URL — it is never transmitted anywhere.
- **HTTPS by default** — when hosted on GitHub Pages, the site is served over HTTPS. GitHub Pages only serves static files and has no ability to intercept or log file contents.
- **Open source** — the entire codebase is visible in this repository. You can verify every line of code, or clone and run it locally if preferred.

## Usage

1. Open `index.html` in any modern browser
2. Drag and drop one or more transcript files (`.vtt` or `.docx`)
3. Toggle backchannel removal on or off
4. Click **Convert**
5. Preview the result and download the cleaned `.txt` file

## Running locally

No build step, no dependencies to install. Just clone and open:

```bash
git clone https://github.com/CarlosAlvarezTR/web-vtt-docx-cleaner.git
cd transcript-cleaner-web
open index.html
```

## How backchannel removal works

The tool identifies short interjections (1–4 words) that consist entirely of filler words like *mhm*, *yeah*, *ok*, *uh-huh*, *sure*, *right*, etc. A backchannel is only removed when it interrupts another speaker's continuous turn — if speaker A is talking, speaker B says "mhm", and then speaker A continues, the "mhm" is stripped out. This keeps the transcript focused on substantive dialogue without losing genuine short responses.

## License

MIT
