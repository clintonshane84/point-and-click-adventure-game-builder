---
layout: default
title: Story Teller
nav_order: 7
---

# Story Teller

The Story Teller lets you write a story as a **book**. A story book is a set of pages the player turns with a page-flip animation. Each page can have text, an illustration, and can be read aloud. Story books are full-screen: they are for narration, not gameplay. Use [Cinematics](cinematics) when you want characters to move and talk inside a scene.

---

## Creating a Story Book

1. Open **Story Teller** from the sidebar.
2. Click **+** in the left panel to create a book, and give it a name.
3. Click **+** in the page list to add a page, then write its text.
4. Optionally pick an **Illustration** from your [Assets](assets) for the page.

### Book settings

| Setting | Meaning |
|---|---|
| Paper | Parchment, White or Dark page colour |
| Font size | Starting text size. Long text is shrunk automatically to fit the page. |
| Read each page aloud | Reads each page as it is turned to |
| Turn page when narration ends | Turns to the next page (or finishes the book on the last page) when the reading ends |

---

## Narration

Each page is read with one of two voices:

- **Text-to-speech** (default): uses the browser's built-in voice. Pick a **Voice**, **Rate** and **Pitch** per page. Use **Listen** in the editor to hear it.
- **Narration audio**: choose an audio asset to play a recording instead. The recording replaces text-to-speech for that page.

If a page has no text or audio, and **Turn page when narration ends** is on, the page turns after a short pause based on its length.

> Browsers may block speech or audio until the player has interacted with the page. The first click or key press in the game unlocks narration.

---

## Playing a Story Book

Story books play in three places:

| Where | How |
|---|---|
| **Before a stage** | Stage Editor → **Story before stage**. Plays before the stage's starting scene loads. |
| **After a stage** | Stage Editor → **Story after stage**. Plays when the stage's goal is completed, before the goal's action (advance, end game or dialog). |
| **Game start** | Tick **Play at game start, before the title menu** on a book. It needs exactly one page, and only one book can have this. Nothing plays at start unless you tick it. |
| **Any time** | [Event Editor](events) → **Play Story** action. |

If a book is already open when another is requested, the second one plays once the first one finishes.

### Controls during a story

| Input | Action |
|---|---|
| Click the right side of the page, **→**, **Space**, **Enter** | Next page |
| Click the left side of the page, **←**, **Backspace** | Previous page |
| **R** or **Read aloud** button | Start or stop reading the page |
| **Skip** button or **Esc** | End the book and continue the game |

Turning to the last page and continuing ends the book and resumes the game.

---

## Page-flip animation

The page turns over the spine with a short fold. The page being revealed sits underneath, so the animation shows the real next (or previous) page.
