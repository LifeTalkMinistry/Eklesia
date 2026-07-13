# Eklesia

Eklesia is a devotional monitoring app for churches. It helps members build a consistent devotional life while allowing leaders to see healthy progress without reading private personal reflections.

## Core Principle

**Track the habit. Protect the heart.**

## Current Capabilities

- Welcome screen and member dashboard
- Private daily reflection flow
- Built-in complete Berean Standard Bible (BSB)
- Lazy-loaded Bible reader with Old and New Testament filters
- Deterministic daily curated verse using the `Asia/Manila` calendar date
- At least one curated reflection entry from every canonical Protestant Bible book
- “Read full chapter” navigation with automatic verse highlighting
- GitHub Pages-compatible static Bible data under `/Eklesia/`
- Frontend accountability ecosystem code prototype

## Accountability Ecosystem Prototype

Members can enter an ecosystem code, review the accountability circle and its privacy boundaries, and confirm joining before the circle overview appears. The current implementation uses local prototype data rather than live church records.

Joined state is saved only on the current device through `localStorage`. Real member accounts, secure code validation, subscription enforcement, multi-user activity, and cross-device synchronization require the future Eklesia backend and database.

The circle interface displays only healthy progress signals. Private reflections, personal prayers, journal entries, and the contents of a member’s devotion are not displayed.

Prototype code: `LIFETALK30`

### Future backend requirements

A connected release will require ecosystem records, owner accounts, unique rotating codes, personal member accounts, ecosystem memberships, subscription-plan member limits, member activity signals, role-based permissions, secure server-side code validation, and cross-device synchronization.

## Bible Source

The Bible text comes only from the official Berean Bible download. The BSB text has been dedicated to the public domain. Full source and conversion documentation is available in [`docs/BIBLE_SOURCE.md`](docs/BIBLE_SOURCE.md).

## Local Development

```bash
npm install
npm run dev
```

## Bible Import

The generated Bible JSON files are committed so deployment does not need to run the importer.

Download and import the official BSB text:

```bash
npm run import:bible
```

Import a previously downloaded official source file:

```bash
node scripts/import-bsb.mjs /path/to/bsb.txt
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

Personal reflections remain private unless the member chooses to share them. Eklesia tracks devotional consistency without exposing the contents of a member’s journal.
