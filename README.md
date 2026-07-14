# Ekklesia Pulse

**Build your rhythm. Strengthen the church.**

Ekklesia Pulse is a devotional accountability ecosystem that helps church members build a consistent rhythm through Scripture, private reflection, and healthy community care.

## Core Experience

- **Daily devotional rhythm:** One completed devotion per `Asia/Manila` calendar day completes the member’s official daily rhythm.
- **Built-in Bible:** The complete Berean Standard Bible (BSB) is available with Old and New Testament filters, chapter navigation, and highlighted passages.
- **Private reflections:** WGAP reflections, prayers, and journal content stay on the member’s current device unless the member chooses to share them elsewhere.
- **Journey history:** Daily and additional devotions remain available in a private date-grouped archive.
- **Accountability circles:** Members can use a prototype circle code to preview healthy accountability and encouragement flows.
- **Church pulse overview:** The Together experience demonstrates privacy-safe activity signals that can help a church notice when encouragement may be useful.
- **Privacy-first monitoring:** Circle views show healthy consistency signals without exposing Scripture selections, reflection text, personal prayers, or journal contents.

## Daily Rhythm and Additional Devotions

The first completed devotion on a Manila calendar date is saved as that date’s **Daily devotion**. It marks one completed day in the weekly rhythm and can increase the rhythm streak only once for that date.

After the daily rhythm is complete, members may complete unlimited **Additional devotions** through another curated suggestion, a passage selected from the built-in Bible, the most recently opened Bible chapter, or a private notebook capture. Additional devotions are saved privately in Journey and do not create another daily check mark, streak day, or accountability completion for the same date.


## Notebook Devotions

Members may capture one photo of a handwritten devotion instead of retyping their private reflection into the app. The browser validates the selected image, resizes its longest edge to a maximum of 1,600 pixels, and compresses it before saving so the photographed handwriting remains readable without retaining the original full-resolution file.

Notebook image Blobs are stored in the `ekklesia-pulse` IndexedDB database inside the `notebookImages` object store. The normal Journey history keeps only private notebook metadata and the persistent image ID; image bytes, base64 data, Blob URLs, EXIF data, camera details, and GPS information are not written to `localStorage`.

Notebook photos remain only in the current browser. They are not uploaded, synchronized across devices, or shown in Together, and they currently have no cloud backup. Clearing browser or site data may remove them permanently. Ekklesia Pulse does not perform OCR, handwriting analysis, sincerity checks, or AI evaluation of a notebook page.

A notebook devotion may complete the official daily rhythm when it is the first devotion saved on a Manila calendar date. Any later notebook or digital devotion on that date is saved as an additional devotion, so multiple devotions still count as only one rhythm day. The current version supports exactly one image per notebook devotion.

## Accountability Circle Prototype

Members can enter an ecosystem code, review the accountability circle and its privacy boundaries, and confirm joining before the circle overview appears. The current implementation uses local prototype data rather than live church records.

Joined-circle state is stored only on the current device. The interface displays healthy progress signals while keeping private reflections, personal prayers, journal entries, devotion passages, and additional-devotion totals out of the circle view.

Prototype code: `LIFETALK30`

## Private Alpha Testing

Ekklesia Pulse is ready for a small private test.

- Testers create a personal profile for the current device.
- No password or online account is created.
- Devotions, WGAP reflections, Journey history, profile details, Bible reading position, and notebook photos remain in browser storage.
- Together currently uses demonstration information and is not connected to live church members.
- Data does not synchronize across devices. Notebook photos currently have no cloud backup.
- Clearing browser storage may remove local information.
- Testers can delete Ekklesia Pulse-owned local data from Profile without clearing unrelated browser storage.
- Alpha feedback is shared through the device share sheet or copied manually.
- Private reflections, prayers, Bible-reading history, notebook content and metadata, and profile identity are excluded from diagnostic feedback automatically.

## Recommended Alpha Scope

Recommended testers: **3–5 trusted churchmates**

Recommended testing areas:

- First-time setup
- Daily devotion
- WGAP completion
- Journey review
- Additional devotion
- Bible reader
- Refresh persistence
- Profile editing
- Feedback sharing
- Local-data deletion

Do not use the current Together demo as an official church attendance or devotion-monitoring record.

## Prototype Limitations

Ekklesia Pulse is currently a frontend prototype. A production-connected release still requires:

- Real member and ecosystem-owner accounts
- Secure server persistence and code validation
- Rotating circle codes and subscription enforcement
- Role-based permissions and member-capacity controls
- Cross-device synchronization
- Notebook-photo cloud backup
- Live multi-user activity and Church Pulse data

Backend functionality and cross-device synchronization are **not yet implemented**.

## GitHub Pages Deployment

The repository has not been renamed because repository-renaming support is unavailable in the current integration. To preserve the existing deployment, the technical Vite and GitHub Pages base path remains `/Eklesia/`.

- Repository: `LifeTalkMinistry/Eklesia`
- Current site: `https://lifetalkministry.github.io/Eklesia/`

The visible application identity is Ekklesia Pulse even while this temporary technical path remains unchanged.

## Bible Source

The Bible text comes only from the official Berean Bible download. The BSB text has been dedicated to the public domain. Full source and conversion documentation is available in [`docs/BIBLE_SOURCE.md`](docs/BIBLE_SOURCE.md).

No Scripture text is generated, paraphrased, or rewritten by the application.

## Local Development

```bash
npm install
npm run dev
```

## Bible Validation

```bash
npm run validate:bible
```

Validation confirms canonical order, 66 books, chapter and verse integrity, complete curated-book coverage, and that daily verse metadata does not duplicate Bible text.

## Production Build

```bash
npm run build
```

The production command validates the Bible data before Vite builds the GitHub Pages bundle.

## Privacy

Personal reflections remain private on the current device unless the member chooses to share them. Ekklesia Pulse tracks devotional consistency without exposing the contents of a member’s journal.
