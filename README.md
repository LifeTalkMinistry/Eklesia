# Ekklesia Pulse

**Build your rhythm. Strengthen the church.**

Ekklesia Pulse is a devotional accountability ecosystem that helps church members build a consistent rhythm through Scripture, private reflection, and healthy community care.

## Core Experience

- **Daily devotional rhythm:** One completed devotion per `Asia/Manila` calendar day completes the member’s official daily rhythm.
- **Built-in Bible:** The complete Berean Standard Bible (BSB) is available with Old and New Testament filters, chapter navigation, and highlighted passages.
- **Private reflections:** WGAP reflections, prayers, and journal content stay on the member’s current device unless the member chooses to share them elsewhere.
- **Journey history:** Daily and additional devotions remain available in a private date-grouped archive.
- **Official ministry membership:** Members select a published church ministry and enter the ministry code provided by its appointed manager.
- **Leader-created groups:** Appointed Group Leaders may create purpose-driven groups for missions, projects, life stages, care needs, and specific communities.
- **Church pulse overview:** The Church Workspace demonstrates privacy-safe activity signals that can help a church notice when encouragement may be useful.
- **Privacy-first monitoring:** Ministry and group views show healthy consistency signals without exposing Scripture selections, reflection text, personal prayers, or journal contents.

## Personal and Church Workspaces

Ekklesia Pulse has two interface environments inside the same application.

**Personal Space** includes Home, Journey, Bible, Together, Profile, personal devotions, private reflections, and the member’s personal rhythm. Together is the place to discover a church organization, enter an organization code, review membership, and launch the church environment.

**Church Workspace** includes Church Pulse, official ministries, leader-created groups, people and scoped roles, and organization privacy controls. Entering this workspace removes the personal header and bottom navigation so the church name and church navigation become the primary interface.

- **My personal space** exits the Church Workspace and returns to Together without removing organization membership.
- **Leave organization** is a separate destructive action that requires confirmation and removes the local membership connection.
- Membership and active-workspace state are stored separately in the current browser.
- The current organization, roles, ministries, groups, codes, privacy settings, and Church Pulse are local demonstration data.
- Real member accounts, backend permissions, live synchronization, and live church information are not implemented.

## Access-Code Hierarchy

The prototype uses three clearly separated code types:

- **Church organization code:** joins the member to the whole church organization.
- **Ministry code:** joins an official ministry that is already published in the Ministries section. The code is provided and managed by that ministry’s appointed manager.
- **Group code:** identifies a flexible group created by an appointed Group Leader. The member enters the code, reviews the group’s purpose and leader, and either joins immediately or sends a leader-approval request.

Rotating a code does not remove members who already belong to the church, ministry, or group.

## Official Ministries

Official ministries are defined and published by the church. A member does not create a ministry by entering a code. Instead, the member opens the Ministries section, chooses a listed ministry, and enters the code provided by that ministry’s manager.

Ministry Leaders receive authority only within their assigned ministry. They can manage the ministry access code without receiving organization-wide administration or access to members’ private devotional content.

## Leader-Created Groups

Groups are separate from official ministries. They are flexible spaces created by qualified people who were appointed by the church as **Group Leaders**.

A group may be:

- church-wide or cross-ministry,
- optionally connected to one official ministry,
- intended for a specific age, life stage, mission, project, or care need,
- temporary, project-based, or ongoing,
- invitation-only, private, or visible to church members,
- automatic-join or leader-approval based.

Creating a group requires the Group Leader role or organization-management authority. Group creation does not grant ministry-manager authority, organization administration, or access to WGAP responses, prayers, journals, notes, exact Scripture selections, or notebook photos.

Legacy local Circle data is migrated into the new Group structure so existing prototype information is not silently lost.

## Daily Rhythm and Additional Devotions

The first completed devotion on a Manila calendar date is saved as that date’s **Daily devotion**. It marks one completed day in the weekly rhythm and can increase the rhythm streak only once for that date.

After the daily rhythm is complete, members may complete unlimited **Additional devotions** through another curated suggestion, a passage selected from the built-in Bible, the most recently opened Bible chapter, or a private notebook capture. Additional devotions are saved privately in Journey and do not create another daily check mark, streak day, or accountability completion for the same date.

## Notebook Devotions

Members may capture one photo of a handwritten devotion instead of retyping their private reflection into the app. The browser validates the selected image, resizes its longest edge to a maximum of 1,600 pixels, and compresses it before saving so the photographed handwriting remains readable without retaining the original full-resolution file.

Notebook image Blobs are stored in the `ekklesia-pulse` IndexedDB database inside the `notebookImages` object store. The normal Journey history keeps only private notebook metadata and the persistent image ID; image bytes, base64 data, Blob URLs, EXIF data, camera details, and GPS information are not written to `localStorage`.

Notebook photos remain only in the current browser. They are not uploaded, synchronized across devices, or shown in Together, and they currently have no cloud backup. Clearing browser or site data may remove them permanently. Ekklesia Pulse does not perform OCR, handwriting analysis, sincerity checks, or AI evaluation of a notebook page.

A notebook devotion may complete the official daily rhythm when it is the first devotion saved on a Manila calendar date. Any later notebook or digital devotion on that date is saved as an additional devotion, so multiple devotions still count as only one rhythm day. The current version supports exactly one image per notebook devotion.

## Private Alpha Testing

Ekklesia Pulse is ready for a small private test.

- Testers create a personal profile for the current device.
- No password or online account is created.
- Devotions, WGAP reflections, Journey history, profile details, Bible reading position, and notebook photos remain in browser storage.
- Together and the Church Workspace currently use demonstration information and are not connected to live church members.
- Ministry joining, group joining, role assignment, and group creation are local prototype interactions.
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
- Church Workspace entry and exit
- Ministry code joining
- Group-code preview and join requests
- Appointed Group Leader creation flow
- Refresh persistence and legacy Circle migration
- Profile editing
- Feedback sharing
- Local-data deletion

Do not use the current prototype as an official church membership, ministry roster, group roster, attendance, or devotion-monitoring record.

## Prototype Limitations

Ekklesia Pulse is currently a frontend prototype. A production-connected release still requires:

- Real member, organization-owner, ministry-manager, and Group Leader accounts
- Secure server persistence and code validation
- Server-enforced role and scope permissions
- Approval queues and member-capacity controls
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
