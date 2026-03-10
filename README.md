# Transcript Cleaner

A browser-based tool that converts raw interview transcripts into clean, readable text. Built for UX researchers who need to quickly turn auto-generated transcripts into something they can actually work with.

**[Try it live](https://your-username.github.io/transcript-cleaner-web)** (replace with your GitHub Pages URL)

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

## Privacy

Everything runs in your browser. No files are uploaded, no data leaves your device, no server is involved. The `.docx` parsing uses [JSZip](https://stuk.github.io/jszip/) to unzip the file client-side.

## Usage

1. Open `index.html` in any modern browser
2. Drag and drop one or more transcript files (`.vtt` or `.docx`)
3. Toggle backchannel removal on or off
4. Click **Convert**
5. Preview the result and download the cleaned `.txt` file

## Running locally

No build step, no dependencies to install. Just clone and open:

```bash
git clone https://github.com/your-username/transcript-cleaner-web.git
cd transcript-cleaner-web
open index.html
```

## How backchannel removal works

The tool identifies short interjections (1–4 words) that consist entirely of filler words like *mhm*, *yeah*, *ok*, *uh-huh*, *sure*, *right*, etc. A backchannel is only removed when it interrupts another speaker's continuous turn — if speaker A is talking, speaker B says "mhm", and then speaker A continues, the "mhm" is stripped out. This keeps the transcript focused on substantive dialogue without losing genuine short responses.

## License

MIT
