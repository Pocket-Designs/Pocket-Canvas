# Pocket-Canvas User Guide

Welcome to Pocket-Canvas: a place to lay out your ideas, plans, mood boards and to-do lists on an endless board, the way you would on a real corkboard.

This guide is for anyone using the app. You don't need any technical knowledge.

### What's new

**Version 1.5**
- **Flowcharts and network diagrams** with the new **Shapes** tool: 12 flowchart shapes and 19 network devices (router, switch, firewall, server, Wi-Fi and more), **+** buttons that let you pick the next shape and add it already joined, right-angled **elbow lines**, **labels on lines**, and two new templates ([section 4](#shapes-flowcharts-and-network-diagrams))
- **Use Pocket-Canvas in a web browser**, with nothing installed, from your own Pocket-Canvas Server ([section 28](#28-using-pocket-canvas-in-a-web-browser))
- **Portable versions** that run without installing, for Windows, Mac and Linux ([section 1](#portable-versions-no-installing))
- **Share boards with other people** and edit them together, live, through your own **Pocket-Canvas Server**, which also syncs your devices without a sync folder ([section 26](#26-sharing-boards-and-your-own-server))
- **PDF for printing**: A4 or Letter pages, portrait, landscape or best fit, and cards are never cut in half ([section 20](#20-exporting-pdf-picture-and-markdown))
- **Your own interface colours**: pick an accent colour and an interface colour in **Settings › Appearance** ([section 21](#21-settings-and-dark-mode))
- **Tables:** paste tables from Excel, Word, Google Sheets and web pages, photos in cells, drag rows and columns to move them, and colour cells, rows and columns with any fill or text colour, plus bold, italic and underline ([section 4](#table))
- **Scroll bars** along the bottom and right of the board whenever pictures or cards are off screen
- **Page guides**: dashed A4 or Letter page outlines on the board, so you can lay things out for printing; turn them on and off with the page button or **Ctrl+Shift+G** ([section 20](#page-guides))
- **Sketches:** pressure-sensitive pens, plus lines, arrows, rectangles and ellipses ([section 4](#sketch))
- **YouTube, Vimeo, Dailymotion and Loom videos** play inside link cards ([section 4](#link))
- **iPhone and iPad app** ([section 27](#27-iphone-and-ipad)), and the web clipper for **Safari** on the Mac
- **Android:** choose the sync folder with Android's own folder picker (no "All files access"), and export pictures and PDFs

**Version 1.4**
- **Pocket-Canvas for Android**, which syncs with your computers ([section 25](#25-the-android-app))
- **Text formatting**: font, size, bold, italic, underline, strikethrough and colour ([section 4](#text-formatting))
- **Line styles**: no arrows, arrows at both ends, dashed or dotted, thicker, straight; and **lines that float freely** on the board ([section 10](#10-drawing-lines-and-arrows))
- **− Row** and **− Column** buttons on tables
- **51 colours** for board icons, or type any colour you like
- The board now starts right at the edge of the window, without a gap
- **More accurate colour names** on Colour cards: a well-known name only when it really is that colour, otherwise a description such as *Dark Golden Brown*
- Touch screens: drag to move around, pinch to zoom, press and hold for the menu

**Version 1.3**
- **Recycle bin:** deleted cards and boards can be restored for 30 days ([section 6](#6-deleting-and-the-recycle-bin))
- Easier deleting: a bin button on selected cards, in the top bar and in the sidebar
- **Password-protected boards**, properly encrypted ([section 8](#8-password-protected-boards))
- **Automatic backups** to a folder you choose, with one-click restore ([section 19](#19-backing-up-and-moving-to-another-computer))
- **Spell checking** with right-click suggestions ([section 15](#15-spelling))

**Version 1.2**
- Every board has a fixed **top-left corner** and grows right and down; templates load at the top-left
- **42 board icons** to choose from (or use your own picture)
- **Colour cards:** type or pick any colour, and its name fills in automatically

**Version 1.1**
- Sync between computers, templates, comments, link previews, tables, audio and video, sketches, PDF/picture export and the browser extension

Version 1.5.5 · © 2026 Pocket-Designs · pocket-designs@proton.me

---

## Contents

1. [Installing Pocket-Canvas](#1-installing-pocket-canvas)
2. [A quick tour of the screen](#2-a-quick-tour-of-the-screen)
3. [Adding cards](#3-adding-cards)
4. [The different kinds of card](#4-the-different-kinds-of-card)
5. [Moving, resizing and tidying cards](#5-moving-resizing-and-tidying-cards)
6. [Deleting and the Recycle bin](#6-deleting-and-the-recycle-bin)
7. [Boards inside boards](#7-boards-inside-boards)
8. [Password-protected boards](#8-password-protected-boards)
9. [Columns](#9-columns)
10. [Drawing lines and arrows](#10-drawing-lines-and-arrows)
11. [Templates](#11-templates)
12. [Comments](#12-comments)
13. [Getting around a board](#13-getting-around-a-board)
14. [Finding things](#14-finding-things)
15. [Spelling](#15-spelling)
16. [Undo, saving and your data](#16-undo-saving-and-your-data)
17. [Syncing between your computers](#17-syncing-between-your-computers)
18. [The browser extension](#18-the-browser-extension)
19. [Backing up and moving to another computer](#19-backing-up-and-moving-to-another-computer)
20. [Exporting: PDF, picture and Markdown](#20-exporting-pdf-picture-and-markdown)
21. [Settings and dark mode](#21-settings-and-dark-mode)
22. [Keyboard shortcuts](#22-keyboard-shortcuts)
23. [Troubleshooting and questions](#23-troubleshooting-and-questions)
24. [Uninstalling](#24-uninstalling)
25. [The Android app](#25-the-android-app)
26. [Sharing boards and your own server](#26-sharing-boards-and-your-own-server)
27. [iPhone and iPad](#27-iphone-and-ipad)
28. [Using Pocket-Canvas in a web browser](#28-using-pocket-canvas-in-a-web-browser)

---

## 1. Installing Pocket-Canvas

### Windows

1. Double-click the installer, for example **Pocket-Canvas Setup 1.5.0.exe**.
2. If Windows shows **"Windows protected your PC"**, click **More info**, then **Run anyway**. This message appears because the app is new and isn't yet registered with Microsoft. It doesn't mean anything is wrong.
3. Choose whether to install for just you or everyone, pick a folder (or keep the suggested one) and click **Install**.
4. Open Pocket-Canvas from the desktop shortcut or the Start menu.

Installing a new version over an old one keeps all your boards.

### Linux

**AppImage (works on most Linux systems, no installing needed)**

1. Right-click **Pocket-Canvas-1.5.0.AppImage** → **Properties** → **Permissions**, and tick **Allow executing file as program**.
2. Double-click it to start.
3. On Ubuntu 22.04 or newer, if nothing happens, open a Terminal and run `sudo apt install libfuse2`, then try again.

**.deb package (Ubuntu, Debian, Linux Mint and similar)**

1. Double-click **pocket-canvas_1.5.0_amd64.deb** to open it in your Software app, then click **Install**.
   Or, in a Terminal in the same folder, run: `sudo apt install ./pocket-canvas_1.5.0_amd64.deb`
2. Find **Pocket-Canvas** in your applications menu.

### Portable versions (no installing)

Each portable version runs straight from where you put it, for example a USB stick or a folder that Google Drive or OneDrive keeps in step.

- **Windows:** download **Pocket-Canvas-…-portable.exe** and double-click it. Nothing is installed. Your boards are kept in a **Pocket-Canvas Data** folder next to the .exe, so the app and its boards travel together. Some work computers don't allow programs to run this way.
- **Linux:** the **.AppImage** is already portable. To keep its boards next to it too, make an empty folder called **Pocket-Canvas Data** beside the AppImage.
- **Mac:** download **Pocket-Canvas-…-mac-arm64.zip** (Apple chip) or **…-mac-x64.zip** (Intel), unzip it and double-click **Pocket-Canvas**. To keep its boards next to it, make an empty folder called **Pocket-Canvas Data** beside the app.

**Help › About Pocket-Canvas** says where a portable version keeps its boards.

Only run a portable copy on **one computer at a time**. If you keep it in a cloud-drive folder, let the drive finish syncing before opening it on another computer. To use your boards on several computers at once, use [sync](#17-syncing-between-your-computers) or a [Pocket-Canvas Server](#26-sharing-boards-and-your-own-server) instead.

**In a web browser:** if you (or someone you know) runs a Pocket-Canvas Server, you can also use Pocket-Canvas in any browser with nothing to download. See [section 28](#28-using-pocket-canvas-in-a-web-browser).

### macOS

1. Download the right **.dmg**: `…-mac-arm64.dmg` for Macs with Apple chips (M1 or later), or `…-mac-x64.dmg` for older Intel Macs. (**Apple menu › About This Mac** shows which you have.) Open it and drag **Pocket-Canvas** into **Applications**.
2. The first time, **right-click** the app and choose **Open**, then click **Open** again. If macOS still blocks it, go to **System Settings → Privacy & Security** and click **Open Anyway**. You only need to do this once.

---

## 2. A quick tour of the screen

```
┌──────────────┬───────────────────────────────────────────────────────────┐
│ Pocket-Canvas│ ☰  Home / Holiday plans     ⟳Synced  Saved ↶ ↷  − 100% + ⤢│ ← top bar
│ [Search…]    ├──────┬────────────────────────────────────────┬───────────┤
│              │ Note │                                        │ Comments  │
│ BOARDS       │ Link │                                        │ (when     │
│ ▾ Home       │ To-do│           your board                   │  open)    │
│   ▸ Holiday  │ Line │   (drag cards anywhere you like)       │           │
│   ▸ Recipes  │ Board│                                        │           │
│              │ …    │                                        │           │
│[Dark/light]  │      │                                        │           │
│[?] [🗑] [⚙]   │      │                                        │           │
└──────────────┴──────┴────────────────────────────────────────┴───────────┘
   sidebar      toolbar
```

- **Sidebar (left):** every board you have, plus search. Click a board to open it. Click the small ▸ / ▾ arrows to show or hide the boards inside it. Right-click a board in the sidebar to rename it, change its icon, lock it or delete it. At the bottom: **Dark / light**, **?** (keyboard shortcuts), the **bin** button (the Recycle bin, with a count) and **⚙ Settings**.
- **Toolbar:** the kinds of card you can add: Note, Link, To-do, Line, Board, Column, Table, Sketch, Heading, Image, Media (audio and video), File and Colour.
- **Top bar:** where you are (for example *Home / Holiday plans*); click an earlier name to go back up. On the right: sync status (if you use sync), whether your work is saved, undo/redo, and zoom.
- **The board:** your working space. It starts at a fixed **top-left corner**, shown by a shaded edge along the top and left, and carries on as far as you like to the **right and down**.
- **Comments panel (right):** appears when you open the comments on a card.

The first time you open Pocket-Canvas you'll see a **Welcome** board with a few example cards. Play with them, then delete them whenever you like.

---

## 3. Adding cards

There are several ways to add a card. Use whichever feels natural.

- **Drag** a tool from the toolbar and drop it exactly where you want it.
- **Click** a tool and the new card appears in the middle of the screen.
- **Double-click** an empty spot on the board to start a note right there.
- **Right-click** an empty spot and choose what to add.
- **Press a letter** (when you're not typing in a card): **N** note, **T** to-do, **H** heading, **B** board, **C** column, **K** link, **G** table, **S** sketch.
- **Shapes** for flowcharts and network diagrams: click **Shapes** in the toolbar and pick one (see [Shapes](#shapes-flowcharts-and-network-diagrams)).
- **Paste** (Ctrl+V): a copied picture becomes a picture card, a copied web address becomes a link card, and copied text becomes a note.
- **Drag from your computer:** drop pictures, documents, music, videos or web links from your desktop, file manager or web browser onto the board. You can drop several at once.
- **Start from a template:** see [Templates](#11-templates).
- **Save from your web browser:** see [The browser extension](#18-the-browser-extension).

---

## 4. The different kinds of card

### Note
For writing anything. Click once to select the note, then click again to start typing.

- **Bold**, *italic* and underline: Ctrl+B, Ctrl+I, Ctrl+U (more in [Text formatting](#text-formatting) below)
- Shortcuts at the start of a line:
  - type `- ` (dash, space) for a bullet list
  - type `1. ` for a numbered list
  - type `# ` for a heading, `## ` for a smaller heading
  - type `> ` for a quote
- Press **Esc**, or click anywhere outside the note, when you've finished.

### Text formatting
While you type in any card, a small **formatting bar** appears just above it:

| Button | What it does |
|---|---|
| **Font ▾** | Default, Sans serif, Serif, Monospace, Handwriting, Rounded or Poster |
| **Size ▾** | From 10 to 64. *Default* puts it back to normal. |
| **B** *I* <u>U</u> ~~S~~ | Bold, italic, underline, strikethrough. Click again to turn off. |
| **A** | Text colour: 16 colours, or *Default colour* |
| **⌫Aa** | Clear formatting |

- **In a note**, select the words you want to change first. With nothing selected, the whole note changes.
- **In other cards** (headings, to-do lists, tables, columns and so on), the change applies to all the card's text.
- Keyboard: **Ctrl+B**, **Ctrl+I**, **Ctrl+U**, and **Ctrl+Shift+X** for strikethrough.

### To-do list
- Give the list a title, then press **Enter** to move to the first task.
- **Enter** adds another task. **Backspace** on an empty task removes it.
- Tick the box to mark a task done. The bar at the top fills up as you go.
- Click **+ Add task** to add one at the end.

### Link
- Paste or type a web address and press **Enter**.
- After a moment, Pocket-Canvas fills in a **preview**: the page's picture, its title, a short description and the site's name and icon.
- Click the site name, or double-click the picture, to open the page in your web browser.
- Click the title to rename it.
- Right-click the card for **Edit web address**, **Refresh preview** or **Remove preview picture**.
- To make the preview, the app briefly visits the page. If you'd rather it didn't, turn off **Link previews** in [Settings](#21-settings-and-dark-mode).
- **Videos:** a link to a **YouTube** (including Shorts), **Vimeo**, **Dailymotion** or **Loom** video becomes a small player.
  - Press **▶** to watch it in the card; **■** stops it. A start time in the link (such as `&t=1m30s`) is kept.
  - Nothing is loaded from the video site until you press Play, and YouTube videos use YouTube's privacy-enhanced player.
  - **Open on YouTube** (or the other site) opens it in your web browser.
  - Right-click › **Show as link card** turns it back into a normal link; **Show as video player** switches back.

### Image (picture)
- Use the **Image** tool to pick pictures, or just paste or drag them in.
- Click **Add a caption** under the picture to write one.
- **Double-click** the picture to open it in your usual picture viewer.
- Right-click → **Save a copy…** to save the picture somewhere else.
- **Empty picture cards** (in templates such as *Mood board*) say *Choose picture*. Click that, or drop or paste a picture onto the card, to fill it.

### Media (audio and video)
- Use the **Media** tool, or drag in a music or video file: MP3, WAV, OGG, M4A, AAC, FLAC, MP4, WebM, MOV and more.
- Each card has its own controls:
  - **▶ Play / ❚❚ Pause**
  - **■ Stop**: stops and goes back to the beginning
  - a **slider** to jump to any point, the time played, and **mute**
- Videos play inside the card. Make the card wider (drag its bottom-right corner) for a bigger picture.
- Starting one card pauses any other that's playing. Music keeps playing while you carry on working on the board.
- If a file won't play, right-click → **Open with default app**.

### File
- Use the **File** tool, or drag any file onto the board: PDFs, Word documents, spreadsheets, zips, anything.
- Click **Open** to open it in its normal app.
- Pocket-Canvas keeps its own copy, so the card still works if you move or delete the original.

### Table
- Add one with the **Table** tool (or press **G**). It starts with 3 × 3 cells, the first row as headings, and you're typing straight away.
- **Tab** moves to the next cell, **Shift+Tab** to the previous one, and **Enter** to the cell below. Moving past the last row adds a new row for you.
- **Shift+Enter** starts a new line inside a cell.
- **+ Row** and **+ Column** appear under the table when you point at it.
- **− Row** and **− Column** delete a row or column. Click a cell in the one you want to remove first; with no cell clicked, they remove the last one. Pointing at the button shades in red what will be deleted. A table always keeps at least one row and one column, and **Ctrl+Z** brings a deleted row or column back.
- **Right-click a cell** to move, insert or delete rows and columns, colour the cell, row or column, or turn the heading row on or off.
- To edit a cell later: click the table once to select it, then click the cell.

**Pasting a table from another program**
- Copy cells from **Excel**, **Google Sheets**, **LibreOffice**, **Word** or a web page, click an empty spot on the board and press **Ctrl+V**. You get a table card with the same rows and columns.
- Fill colours, text colours, **bold**, *italic* and underlining come across too, when the program includes them. Merged cells are spread out into separate cells.
- Tab-separated text pastes as a table too.
- **To paste into a table you already have**, click into a cell and press **Ctrl+V**. The cells fill from that one, and rows and columns are added if needed. **Ctrl+Z** undoes it.
- Copying a single cell still pastes as ordinary text.

**Photos in cells**
- **Drag a photo** from your computer onto a cell, or **paste** one (Ctrl+V) while typing in a cell. You can also right-click a cell and choose **Add a picture…**.
- The photo fills the width of the cell, with the cell's text underneath. Make the table wider (drag its bottom-right corner) for bigger photos.
- **Double-click** a photo to open it in your usual picture viewer.
- Right-click the cell for **Replace picture…**, **Open picture**, **Save a copy of the picture…** or **Remove picture**.
- Photos move with their row or column, sync to your other devices, and appear in exports.

**Moving rows and columns**
- Point at the table and small orange **grips** appear: one on the top edge of each column and one on the left edge of each row.
- **Drag a grip** onto another row or column to move it there. A line shows where it will land.
- While typing in a cell, **Alt+↑ / Alt+↓** move its row up or down, and **Alt+← / Alt+→** move its column. You keep typing in the same cell.
- Right-click a cell (or a grip) for **Move row up / down** and **Move column left / right**.
- Colours and styles move with their row or column, and **Ctrl+Z** undoes a move.

**Colours and text styles**
While you type in a cell, the formatting bar above the table has two extra buttons on the left:
- **This cell ▾** chooses what the other buttons change: *This cell*, *This row*, *This column* or *Whole table*. While the pointer is over the bar, the cells it will change are outlined.
- **Fill** (the paint pot) gives them a background colour: 20 ready-made colours, **Pick any colour…** for any other, or **No fill**.

The other buttons work on the same choice:
- **B**, ***I***, <u>**U**</u> and ~~**S**~~: bold, italic, underline and strikethrough. **Ctrl+B**, **Ctrl+I** and **Ctrl+U** work too.
- **A**: text colour, from 16 colours or **Pick any colour…**
- **Clear formatting** removes the colours and styles from the chosen cell, row, column or table.
- The **font** and **size** always apply to the whole table.

You can also right-click a cell and choose **Colour this cell…**, **Colour this row…**, **Colour this column…** or **Text colour and style…**.

Where a coloured row crosses a coloured column, **whatever you did last wins**, so you can colour a whole row and then pick out single cells in it.

### Sketch
A blank sheet to draw on: diagrams, doodles, storyboard frames, handwriting.
- Add one with the **Sketch** tool (or press **S**). You're straight into drawing mode.
- To draw on a sketch later, **double-click** it (or select it and press **Enter**).
- In drawing mode, a pen bar appears at the top of the board:
  - **tools:** pen, straight line, arrow, rectangle and ellipse. For shapes, drag from one corner to the other. Hold **Shift** for a perfect square or circle, or to keep lines level, upright or at 45°.
  - **Fill:** rectangles and ellipses get a light tint of their colour
  - **colours** (including white, to draw over things)
  - **sizes**: fine, medium, thick and marker
  - **Eraser**: drag over a line or shape to remove it
  - **Undo line** and **Clear**
  - **Done** (or press **Esc**, or click elsewhere on the board) when you've finished
- Works with a mouse, touchpad, touch screen or drawing pen.
- **Pressure-sensitive:** with a pen that senses pressure (such as a Wacom pen, Surface Pen, S Pen or Apple Pencil), pressing harder draws a thicker line. A mouse draws at an even thickness.
- Drawings stay crisp however much you zoom or resize the card.

### Shapes (flowcharts and network diagrams)
Use shapes to draw a process step by step, or a map of your network.
- Click **Shapes** in the toolbar (or right-click an empty spot › **Add shape here…**). Pick from two tabs:
  - **Flowchart:** process, start/end, decision (diamond), input/output, document, database, sub-process, preparation, manual step, delay, connector (circle) and **Area / group**.
  - **Network:** internet, modem/ONT, router, firewall, switch, wireless access point, server, virtual machine, storage/NAS, computer, laptop, phone, tablet, desk phone, printer, camera (CCTV), sensor/IoT, person and site/building.
- Type straight away: flowchart shapes have their words inside; network devices have a **name**, and a second line underneath for an **IP address or a note**.
- **Add the next shape:** select a shape or device and click a **+** on any side. Pick which shape or device comes next (the usual choice is highlighted; press **Enter** for it). It appears on that side, already joined, ready for you to type. Flowchart shapes are joined with an elbow arrow, network devices with a plain cable. **Shift+click** the **+** to skip the question and add the usual next shape: a normal step after a decision or start/end, otherwise the same again.
- **Resize** flowchart shapes from the corner, in both directions. Hold **Shift** to keep a circle or diamond even.
- **Area / group** draws a dashed box with a title, and always sits behind other cards. Use it for a VLAN, a room, an office or a site, then put devices inside it.
- **Change a shape** without losing its words or lines: right-click › **Change shape…**.
- Change a shape's colour from the right-click menu, as with other cards.
- Join shapes with the **Line** tool. For flowcharts, **elbow** lines (right angles) look neatest; for networks, straight lines with no arrows. Double-click a line to give it a label, such as **Yes**, **No**, **VLAN 10** or **1 Gbps** (see [Drawing lines and arrows](#10-drawing-lines-and-arrows)).
- For a quick start, use the **Flowchart** or **Network diagram** template (see [Templates](#11-templates)).

### Board
A board inside your board. See [Boards inside boards](#7-boards-inside-boards).

### Column
A tidy stack of cards. See [Columns](#9-columns).

### Heading
Big bold text for labelling areas of a board, such as "Ideas", "Done" or "Week 1".

### Colour swatch
- Add one with the **Colour** tool. The colour code is ready for you to type straight away.
- **Type a colour code** such as `#3A7BE0` (the `#` is optional, and short codes like `#38F` work too), then press **Enter**. Or **click the coloured block** to choose from the colour picker.
- The **name fills in automatically** and updates whenever you change the colour:
  - if the colour is a well-known named colour (or so close you couldn't tell them apart), you get that name, for example `#8B4513` is *Saddle Brown* and `#2E8B57` is *Sea Green*
  - otherwise you get a plain description, for example `#5B3600` is *Dark Golden Brown*, `#7F2E00` is *Reddish Brown* and `#3A7BE0` is *Blue*
- Colour cards named by an older version get the more accurate names when you next open Pocket-Canvas. Names you typed yourself are never changed.
- Prefer your own name, such as *Brand orange*? Click the name and type it. Your name then stays, even if you change the colour. Delete the name to switch automatic naming back on.
- Drag the card by its coloured block to move it.
- Great for colour palettes and mood boards.

---

## 5. Moving, resizing and tidying cards

| To… | Do this |
|---|---|
| Select a card | Click it |
| Edit a card | Click it once to select it, then click again (or press **Enter**) |
| Move a card | Drag it |
| Select several cards | Drag a box around them on an empty part of the board, or hold **Shift** and click each one |
| Select every card on the board | **Ctrl+A** |
| Nudge cards a little | Arrow keys (hold **Shift** for bigger steps) |
| Make a card wider | Drag its bottom-right corner |
| Colour-code a card | Right-click it and pick a colour (pick the crossed-out circle for none) |
| Put a card on top of others | Right-click → **Bring to front** |
| Copy a card | **Ctrl+D** to duplicate it in place, or **Ctrl+C** then **Ctrl+V** (works between boards too) |
| Delete a card | Click the **bin** button on the selected card, or press **Delete**, or right-click → **Move to Recycle bin**. See [Deleting and the Recycle bin](#6-deleting-and-the-recycle-bin). |

> **Tip:** Copying cards also copies their text, so you can paste it straight into an email or document.

---

## 6. Deleting and the Recycle bin

### Deleting cards
Select one or more cards, then any of these:
- click the round **bin** button on the selected card
- click the **bin** button in the top bar
- press **Delete** (or Backspace)
- right-click › **Move to Recycle bin**

### Deleting boards
- Select the board's card and delete it like any card, **or**
- right-click the board in the **sidebar** › **Move to Recycle bin**, **or**
- inside the board, right-click an empty spot › **Delete this board**.

Everything inside the board goes with it. Home can't be deleted.

### The Recycle bin
Nothing is gone straight away. Deleted cards and boards go to the **Recycle bin**: click the **bin** button at the bottom of the sidebar (the number shows how many items are in it), or choose **Edit › Recycle Bin…**.

- **Restore** puts things back where they were, with the lines between them and their place in a column. Boards come back with everything inside.
- **Delete** removes one item for good. **Empty Recycle bin** removes everything.
- Items stay for **30 days**, then they're removed automatically. Each one shows how many days it has left.
- Straight after deleting, the message at the bottom has an **Undo** button too.
- If you use sync, the Recycle bin is the same on all your computers.

---

## 7. Boards inside boards

Boards help you keep things organised, like folders, but visual. A **Holiday** board could hold a **Packing** board and a **Places to visit** board, and so on, as deep as you like.

- **Make a board:** use the **Board** tool and type a name straight away. Or start one from a template with **File › New Board from Template…** (Ctrl+Shift+N).
- **Open a board:** double-click its card, or click its coloured icon, or click it in the sidebar.
- **Go back up:** click an earlier name in the top bar, or press **Alt+←**.
- **Rename a board:** click its name on the card, or click the current board's name in the top bar.
- **Change a board's icon and colour:** right-click its card › **Change icon…** (or, inside the board, right-click an empty spot › **Change this board's icon…**). Pick from 42 icons, such as Home, Star, Idea, Calendar, Travel or Music, and **51 background colours**: 17 colours, each in a light, middle and deep shade. For any other colour, use **Your own colour**: click the colour box to pick one, or type a colour code such as `#0F8A5F` and press **Enter** (its name appears next to it). The icon shows on the board's card and in the sidebar.
- **Use your own picture as a board's icon:** in the same window, click **Use my own picture…**. **Remove my picture** goes back to the icon.

### Moving cards into another board
- Drag a card (or several selected cards) **onto a board card**; it turns orange when you're over it. Let go and the cards move inside.
- Or drag cards onto a board's name in the **sidebar**, or onto a name in the **top bar**.
- Or right-click → **Move to board…** and pick from the list.

### Deleting a board
See [Deleting and the Recycle bin](#6-deleting-and-the-recycle-bin). Deleted boards, and everything in them, can be restored from the Recycle bin for 30 days.

---

## 8. Password-protected boards

Keep private boards private: a diary, finances, surprise plans.

### Locking a board
1. Right-click the board's card (or the board in the sidebar) › **Lock with a password…**
2. Type a password twice: **at least 6 characters**. Add a hint if you like; the hint is shown to anyone who tries to open the board, so don't put the password in it.
3. Click **Lock board**.

A padlock appears on the board's card and next to it in the sidebar.

> ⚠️ **Don't forget the password.** The board is properly encrypted, so if the password is lost, nobody can open it. There's no reset and no back door. Consider writing it somewhere safe.

### Opening a locked board
Open it as usual. Pocket-Canvas asks for the password (and shows your hint). Boards inside it then open without asking again.

While it's open, the top bar shows **Unlocked · Lock now**.

### When it locks again
- as soon as you **leave** the board (go to a board outside it)
- when you click **Unlocked · Lock now**
- every time Pocket-Canvas starts

### Changing or removing the password
Open the board, then right-click its card or its name in the sidebar › **Change password…** or **Remove password…**

### What's protected
- Everything on the board, and all the boards inside it, is encrypted on your computer, in the sync folder, in backups and in exports.
- Cards you delete from inside a locked board stay encrypted in the Recycle bin; open the board to restore them.
- The board's **name, colour and icon** are still visible, so you can find it.
- **Pictures and files** you add are stored like any others, so someone with access to your data folder could see the picture files themselves, though not which board they belong to.
- You can't drag cards onto a locked board until it's open, and the browser extension saves to Home instead.

---

## 9. Columns

Columns keep cards in a neat list, which is handy for lists of ideas, stages of a project, or a simple to-do/doing/done layout.

- Add a column with the **Column** tool and give it a title.
- **Drag a card onto a column** to add it. An orange line shows where it will go.
- **Drag cards up and down** inside the column to reorder them.
- **Drag a card out** of the column onto the board to take it out. Or right-click it → **Take out of column**.
- Moving the column moves everything in it.

---

## 10. Drawing lines and arrows

Lines show how ideas connect, such as steps in a process or a mind map. They can also be used on their own: an arrow pointing at something, a divider, or an underline.

### Drawing a line
1. Click the **Line** tool (or press **L**).
2. Click where the line starts, then where it ends. Each end can be **on a card** (the line is attached to it) or **anywhere on the board** (that end is free).
   You can also press, drag and let go.

Or right-click a card → **Draw line from here**, then click where it should end. Press **Esc** to stop drawing a line part-way.

### Choosing the style
While you're drawing, and whenever a line is selected, a **line style bar** appears at the top of the board:

| Group | Choices |
|---|---|
| Arrows | none · at the end · at the start · at both ends |
| Pattern | solid · dashed · dotted |
| Thickness | thin · medium · thick |
| Shape | curved · straight · elbow (right angles, for flowcharts) |

Whatever you pick is also used for your next new line. The bar also has **Delete**.

### Labels on lines
**Double-click** a line to type a label for it, such as **Yes** or **No** in a flowchart, or **VLAN 10** or **1 Gbps** on a network cable. The label sits in the middle of the line. Double-click the label to change it, or right-click the line › **Remove label**.

### Moving lines and their ends
- **Ends on a card** follow the card when you move it.
- Click a line to select it. A round **handle** appears on each end.
  - Drag a handle onto a card or shape to attach it (the card lights up). This is how you move a line to a different shape.
  - On a network device, the empty space either side of the name doesn't count as the device, and inside an **Area** only the title and dashed edge do, so lines that pass there can still be clicked.
  - Drag a handle anywhere else to free that end.
- Drag the middle of a line to move it. Its free ends move; ends on cards stay put.

### Right-clicking a line
You get the same choices as the style bar, plus:
- **Add a label…** / **Change label…** and **Remove label**
- **colour**
- **Reverse direction**
- **Detach from cards**: frees both ends where they are
- **Delete line**

---

## 11. Templates

Templates give you a ready-made layout so you don't start from a blank board.

### Ready-made templates

| Template | What's in it |
|---|---|
| **Mood board** | Picture spaces to fill, a colour palette, keywords and inspiration links |
| **Storyboard** | Six scenes, each with a sketch frame and notes for action, dialogue and shot |
| **Project plan** | Goal, milestones, To do / Doing / Done columns, a timeline table, plus *Meeting notes* and *Files & resources* boards |
| **Mind map** | A main idea joined to six branches |
| **Weekly planner** | A column with a to-do list for each day, and a focus for the week |
| **Brainstorm** | A question, coloured idea notes, a sketch area and a *Best ideas* column |
| **Flowchart** | Start, a step, a Yes/No decision and End, joined with labelled elbow lines |
| **Network diagram** | Internet, modem, firewall, core switch and Wi-Fi, with servers, office devices and cameras grouped into VLAN areas, IP addresses and labelled cables |

### Using a template
- **As a new board:** **File › New Board from Template…** (Ctrl+Shift+N). Pick a template and a new board is made and opened.
- **On the board you're on:** right-click an empty spot › **Insert a template…**. Or, on an empty board, click **Start from a template**.

Templates always load at the **top-left corner** of the board. If the board already has cards, the template goes at the left edge, just below everything that's there, and the board scrolls to show it.

Everything in a template can be changed, moved or deleted. It's your board now. Boards made from templates get a matching icon, for example a palette for *Mood board*.

### Making your own templates
1. Set up a board just how you like it, including any boards inside it.
2. Choose **File › Save Board as Template…**, or right-click a board's card › **Save as a template…**, or right-click an empty spot › **Save this board as a template…**.
3. Give it a name and, if you like, a description.

It appears under **My templates** in the template gallery. To rename or delete one, use the buttons on it in the gallery. Comments aren't copied into templates.

If you use [sync](#17-syncing-between-your-computers), your templates appear on your other computers too.

---

## 12. Comments

Leave notes to yourself, or questions and answers, on any card without changing the card itself.

- **Add or read comments:** right-click a card › **Add comment** (or **Comments**), or select it and press **Ctrl+Shift+M**. A panel opens on the right.
- Type your comment and click **Comment**, or press **Ctrl+Enter**.
- Cards with comments show an orange **💬 number** badge. Click it to open the comments.
- Point at a comment to **Resolve** (tick it off), **Edit** or **Delete** it. Resolved comments are hidden. Tick **Show resolved** to see them again, and **Reopen** to bring one back.
- Comments show your name. Change it in **Settings › General** (or click your name under the comment box).
- Search (Ctrl+F) looks inside comments too.

---

## 13. Getting around a board

| To… | Do this |
|---|---|
| Move around | Scroll with the mouse wheel or touchpad. Or hold **Space** and drag. Or drag with the middle mouse button. You can go as far as you like right and down; the top-left corner is where the board stops. |
| Move sideways | Scroll sideways on a touchpad, or hold **Shift** while scrolling |
| Zoom in or out | Hold **Ctrl** and scroll, or use **−** / **+** in the top bar |
| Back to 100% | Click the percentage in the top bar, or **Ctrl+0** |
| See everything on the board | The **⤢** button, or **Ctrl+1**: shows everything from the top-left corner |
| Scroll with the scroll bars | When something is off screen, a **scroll bar** appears along the bottom (for things off to the right) and down the right-hand side (for things further down). Drag the handle, or click either side of it to jump about a screen. |
| See where printed pages fall | The **page button**, or **Ctrl+Shift+G** ([page guides](#page-guides)) |
| Hide the sidebar for more room | The **☰** button, or **Ctrl+\\** |

**On a touch screen:** drag one finger on an empty part of the board to move around, pinch with two fingers to zoom, and press and hold anything for its right-click menu.

Each board remembers where you were looking and how far you'd zoomed.

---

## 14. Finding things

Type in the **Search** box at the top of the sidebar (or press **Ctrl+F**). Pocket-Canvas searches **every board** at once: notes, to-do lists, links and their descriptions, headings, captions, tables, file names, board names and comments.

Click a result to jump straight to it. The card flashes so you can spot it. Press **Esc** to clear the search.

---

## 15. Spelling

Pocket-Canvas checks your spelling as you type in notes, headings, to-do lists, tables, captions and comments. Misspelt words get a red underline.

- **Right-click** an underlined word for suggestions; click one to replace the word.
- **Add “word” to dictionary** stops it being underlined, which is good for names and jargon.
- The same right-click menu has **Cut**, **Copy**, **Paste** and **Select all**.

In **Settings › Spelling** you can:
- turn spell checking on or off
- choose the language (English (UK) is the default) and an optional second language
- see the words you've added to your dictionary, and remove any

On a Mac, the languages come from **System Settings › Keyboard › Text Input**. On Windows and Linux, a language's dictionary may be downloaded the first time you use it.

---

## 16. Undo, saving and your data

- **Everything saves automatically.** The top bar shows *Saving…* and then *Saved*. There's no Save button to remember.
- **Undo** with **Ctrl+Z** and **redo** with **Ctrl+Shift+Z**, or use the ↶ ↷ buttons. You can undo up to 80 steps, including deleting cards and whole boards.
- **Your work stays on your computer.** Pocket-Canvas doesn't need an account. The internet is only used for link previews (which you can turn off), and your boards only leave your computer if you turn on sync with your own sync service.

### Where your boards are kept

| Computer | Folder |
|---|---|
| Windows | `%APPDATA%\Pocket-Canvas` (paste this into the File Explorer address bar) |
| Linux | `~/.config/Pocket-Canvas` |
| macOS | `~/Library/Application Support/Pocket-Canvas` |

The quickest way to get there is **File → Open Data Folder** inside the app.

Inside you'll find:
- **pocket-canvas-data.json**: all your boards and cards
- **pocket-canvas-data.json.bak**: the previous save, kept as a safety copy
- **assets**: the pictures, files, audio and video you've added
- **settings.json**: this computer's settings

---

## 17. Syncing between your computers

Sync keeps your boards the same on all your computers: a desktop and a laptop, say, or a Windows PC and a Linux machine.

Pocket-Canvas doesn't run its own cloud service. It uses a **sync folder**, a folder that a sync service you already use keeps the same on each computer, such as **Dropbox**, **OneDrive**, **Google Drive**, **iCloud Drive**, **Nextcloud** or **Syncthing**. That way your boards go wherever *you* choose, including a Nextcloud or Syncthing you run yourself.

### Setting it up
1. Make sure your sync service is installed and working on each computer.
2. On the first computer: **Settings › Sync › Choose sync folder…** and pick a folder inside your sync service, for example your *Dropbox* folder. Pocket-Canvas creates a **Pocket-Canvas Sync** folder there.
3. Wait for your sync service to copy that folder to the other computer.
4. On the other computer: **Settings › Sync › Choose sync folder…** and pick the **same** folder.

That's it. Within a few seconds of a change on one computer (plus however long your sync service takes), it appears on the others.

### How it behaves
- **Nothing is overwritten wholesale.** Pocket-Canvas compares changes card by card:
  - cards added or changed on different computers are **all kept**
  - if the **same** card was changed on two computers, the **most recent** change wins
  - a card deleted on one computer is deleted everywhere, unless it was changed on another computer *after* it was deleted, in which case it's kept
- If both computers already had boards before you turned sync on, everything is **combined**, including both Home boards.
- Pictures, files, audio and video sync too. They may take a little longer to arrive than the cards.
- Scroll position, zoom, dark/light mode and settings stay separate on each computer.
- The top bar shows **⟳ Synced**. It briefly says **Updated** when changes arrive, or **Sync problem** if the folder can't be reached. Click it to see details, including your other computers and when each last changed something.
- No connection? Keep working. Changes are shared when the sync folder is available again.
- Undo history is cleared when changes arrive from another computer, so you can't accidentally "undo" someone else's change.

### Stopping
**Settings › Sync › Stop syncing.** Your boards stay on this computer; it just stops sharing changes. Other computers keep their copies.

> **Tip:** Give each computer a recognisable name in **Settings › General › This computer's name**. That's how it's shown on your other computers.

---

## 18. The browser extension

The **Pocket-Canvas Web Clipper** saves things from your web browser straight onto your boards. It works in **Chrome, Microsoft Edge, Brave, Opera, Vivaldi and Firefox**, and in **Safari** on the Mac (installing it in Safari is explained in [the Safari guide](SAFARI.md)).

### Installing it

**From your browser's add-on store** (when published): search for *Pocket-Canvas*.

**Without a store**, from the extension zip file (`pocket-canvas-web-clipper-1.5.0.zip`):

*Chrome, Edge, Brave, Opera, Vivaldi*
1. Unzip the file into a folder you'll keep.
2. Open the extensions page: type `chrome://extensions` in the address bar (Edge: `edge://extensions`, Opera: `opera://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose the unzipped folder.
5. Click the puzzle-piece icon in the toolbar and **pin** Pocket-Canvas so its button is always visible.

*Firefox*
- To try it: open `about:debugging` › **This Firefox** › **Load Temporary Add-on…** and choose `manifest.json` in the unzipped folder. Firefox removes it when it closes.
- To keep it: Firefox needs a signed copy. Use the signed `.xpi` file if you have one (drag it into Firefox), or see the extension's README for how to sign it for free.

### Connecting (once per browser)
1. Make sure Pocket-Canvas is open.
2. Click the Pocket-Canvas button in your browser's toolbar, then **Connect**.
3. Pocket-Canvas asks *"Let the Pocket-Canvas extension in Chrome save to your boards?"*. Click **Allow**.

### Saving things
**With the toolbar button:**
- Choose the **board** to save to. It remembers your choice.
- Optionally type a **note**. It's saved as a comment on the card.
- **Save page**: a link card with the page's preview.
- **Save selected text**: select some text on the page first. It's saved as a note with a link back to the page.
- **Save screenshot**: a picture of what you can see on the page.

**With the right-click menu** on a web page:
- **Save page / link / picture / video / audio / selected text to Pocket-Canvas**
- A green ✓ on the toolbar button means it worked. A red ! means it didn't; point at the button to see why.

Everything you save goes into a **From the web** column on the chosen board, newest at the top. Drag things out of it wherever you like.

> Videos from sites like YouTube can't be downloaded; Pocket-Canvas saves a link card with a preview instead. Video and audio files the page links to directly are saved as playable cards.

### Privacy
The extension only talks to the Pocket-Canvas app on your own computer. It doesn't send anything to the internet, and it only reads a page when you choose to save something from it. Websites can't use the connection. See or disconnect connected browsers in **Settings › Browser extension**.

---

## 19. Backing up and moving to another computer

### Automatic backups
Pocket-Canvas **backs up all your boards automatically, once a day**, into a folder called **Pocket-Canvas Backups** in your **Documents**.

For real protection, keep backups somewhere else: another drive, a USB stick, or a cloud folder (OneDrive, Dropbox…). Go to **Settings › Backups** (or **File › Backups…**):

- **Change folder…**: choose where backups go. New backups go there from then on; existing ones stay where they were.
- **How often**: every hour, every day, every week, or only when you click **Back up now**
- **Keep**: how many backups to keep (30 by default); older ones are deleted
- **Back up now** (also **File › Back Up Now**)
- **Open folder**: see the backups

Pictures and files are kept once in the backup folder and shared between backups, so backups don't take up much space. Locked boards stay encrypted.

### Restoring a backup
**Settings › Backups**, find the date you want under **Restore from a backup**, and click **Restore**. Your boards are replaced with that backup. Before that happens, a backup of your boards as they are now is made automatically, so you can always change your mind. If you use sync, your other computers get the restored boards too.

### Copying everything by hand
**The simplest, most complete backup:**

1. Close Pocket-Canvas.
2. **File → Open Data Folder** (open the app briefly if you need to), then go up one level.
3. Copy the whole **Pocket-Canvas** folder to a USB stick, external drive or cloud storage.

**To move to another computer:** install Pocket-Canvas there, open it once and close it again. Then replace its **Pocket-Canvas** data folder with your copy. (Or, easier, set up [sync](#17-syncing-between-your-computers) on both.)

**Quick backup of boards only:** **File → Export All Data (Backup)…** saves all your boards, text and templates to one file. Restore it with **File → Import Backup…**. This file *doesn't include your pictures and attached files*; for those, use the folder copy above.

> **Coming from PocketCanvas (the earlier name)?** The first time you open Pocket-Canvas it copies your old boards, pictures and files across automatically. Your old folder is left alone; delete it once you're happy.

---

## 20. Exporting: PDF, picture and Markdown

### As a PDF or picture
**File › Export Board as Picture or PDF…** (Ctrl+Shift+E), or right-click an empty spot › **Export board as picture or PDF…**

- **Picture (PNG):** for sharing in messages, documents and presentations. Choose **Standard** or **High** quality.
- **PDF, one big page:** the whole board on a single page, for email and viewing on screen. Text stays sharp however far you zoom in.
- **PDF for printing:** the board on **A4** or **Letter** pages. With [page guides](#page-guides) on, it prints exactly the pages the guides show. Otherwise (**Fit automatically**):
  - Choose **Portrait**, **Landscape**, or **Best fit**, which picks whichever needs fewer pages, then the one with bigger cards.
  - The board is scaled to fit the page width (never enlarged).
  - **A card that would be cut by the edge of a page moves to the top of the next page**, along with everything below it, just like a page break in a document.
  - A card taller than a whole page starts on a fresh page and carries on over the next.
- **Background:** the board's colour, white, or (for pictures) transparent.

Pictures and one-page PDFs include the whole board, at full size, however big it is. It looks exactly as it does on screen, including pictures, sketches, tables and lines; selection outlines and buttons are left out. When it's done, click **Show file** to find it.

Only the board you're on is exported, not the boards inside it. Export those separately.

### Page guides
Page guides show where the printed pages fall, so you can arrange a board to print nicely.

- **To turn them on or off:**
  - click the **page button** at the top right (next to ⤢)
  - or press **Ctrl+Shift+G**
  - or right-click an empty spot › **Show page guides**
  - on Android, iPhone and iPad: **⋮ › Page guides…**
- **What you see:** dashed outlines of pages, starting at the board's top-left corner and going right and down, numbered *Page 1*, *Page 2* and so on in printing order. Pages with nothing on them say *Blank – not printed*.
- **Cards that cross a page edge** get an orange outline. The label at the bottom left of the board counts them, along with the number of pages. Move or resize a card until its outline disappears and it will print in one piece.
- **Settings**, from the page button's menu:
  - **A4** or **Letter**
  - **Portrait** or **Landscape**
  - **Size:** *Actual size*, *Smaller (75%)* or *Smallest (50%)*. Smaller sizes fit more of the board on each page.
  - **Print these pages as a PDF…**
- Each board remembers its own page guide settings, and they sync with the board.

**Printing what the guides show:** with page guides on, the export window chooses **PDF for printing › Follow the page guides** for you. Each page on the board becomes one page in the PDF, exactly as shown; blank pages are left out. Choose **Fit automatically** instead to have Pocket-Canvas arrange the pages for you, as described above.

### As Markdown
**File → Export Board as Markdown…** saves the board you're looking at, and every board inside it, as a text file. Markdown files open in any text editor and many note-taking apps (such as Obsidian, Joplin or Notion). To-do lists keep their ticks, links stay clickable and tables stay tables.

---

## 21. Settings and dark mode

Open **Settings** with the **⚙** button at the bottom of the sidebar, **File › Settings…**, or **Ctrl+,**.

- **General**
  - **Your name**: shown on comments you write
  - **This computer's name**: shown on your other computers when syncing
  - **Link previews**: on or off
- **Appearance**: the look of Pocket-Canvas itself
  - **Light or dark**: *Light*, *Dark*, or *Match this computer* (follows your computer's own setting)
  - **Accent colour**: the colour of buttons, highlights and the board you're on. Pick one of 14 colours, or click the rainbow circle for any colour. On pale colours, button text turns dark so it stays readable.
  - **Interface colour**: the colour of the sidebar, top bar, board background and panels. Choose *Warm sand* (the standard), *Stone grey*, *Cool slate*, *Sky blue*, *Sage green*, *Mint*, *Lavender*, *Rose*, *Peach* or *Lemon*, or **Your own…** for any colour. Light and dark mode each get matching shades.
  - **Back to the standard colours** undoes your changes.
  - Colours change straight away, and are kept on this computer only; your other computers keep their own. Card and board colours aren't affected.
- **Spelling**: see [Spelling](#15-spelling)
- **Backups**: see [Backing up and moving to another computer](#19-backing-up-and-moving-to-another-computer)
- **Sync**: see [Syncing between your computers](#17-syncing-between-your-computers)
- **Server**: sign in to a Pocket-Canvas Server, see [Sharing boards and your own server](#26-sharing-boards-and-your-own-server)
- **Browser extension**: allow or block the extension, see and disconnect connected browsers, and change the port (only if another program needs it)

Also:
- **Dark / light:** click **Dark / light** at the bottom of the sidebar, or press **Ctrl+Shift+L**. Until you choose, Pocket-Canvas follows your computer's own setting.
- **Shortcuts list:** click **?** at the bottom of the sidebar, or press **F1**.
- **Full screen:** **View → Toggle Full Screen** (F11 on Windows and Linux).

---

## 22. Keyboard shortcuts

On a Mac, use **Cmd** wherever this says **Ctrl**.

**Adding** (when you're not typing in a card)

| Key | Adds |
|---|---|
| N | Note |
| T | To-do list |
| H | Heading |
| B | Board |
| C | Column |
| K | Link |
| G | Table |
| S | Sketch |
| L | Start drawing a line |
| Double-click empty board | Note at that spot |
| Ctrl+V | Paste a picture, link or text as a card |
| Ctrl+Shift+N | New board from a template |

**Working with cards**

| Key | Does |
|---|---|
| Enter | Edit the selected card, open a selected board, or draw on a selected sketch |
| Esc | Stop editing / finish drawing / deselect / cancel a line |
| Delete or Backspace | Move the selection to the Recycle bin |
| Ctrl+D | Duplicate |
| Ctrl+C / Ctrl+X / Ctrl+V | Copy / cut / paste cards |
| Ctrl+A | Select all cards |
| Arrow keys | Nudge (Shift for bigger steps) |
| Ctrl+Z / Ctrl+Shift+Z | Undo / redo |
| Ctrl+Shift+M | Comments on the selected card |
| Ctrl+Enter | Post a comment |

**In a table**

| Key | Does |
|---|---|
| Tab / Shift+Tab | Next / previous cell |
| Enter | Cell below (adds a row at the end) |
| Shift+Enter | New line inside the cell |

**Moving around and more**

| Key | Does |
|---|---|
| Scroll | Move around |
| Space + drag | Move around |
| Ctrl + scroll | Zoom |
| Ctrl+= / Ctrl+− | Zoom in / out |
| Ctrl+0 | Zoom to 100% |
| Ctrl+1 | Fit everything on screen |
| Ctrl+Shift+G | Page guides on / off |
| Alt+← | Go up to the parent board |
| Ctrl+F | Search all boards |
| Ctrl+Shift+E | Export board as picture or PDF |
| Ctrl+, | Settings |
| Ctrl+\\ | Show / hide sidebar |
| Ctrl+Shift+L | Dark / light mode |
| F1 | Shortcuts list |

---

## 23. Troubleshooting and questions

**I pressed a letter and a card appeared, but I wanted to type.**
You weren't editing a card yet. Delete the new card (or press Ctrl+Z), then click the card you want **twice**: once to select, once to start typing.

**I can't select text in a note; it moves the card instead.**
Click the note once to select it, then click again. Now you can type, select text and move the cursor. Dragging only moves the card when you're not editing.

**A card won't go any further left or up.**
That's the board's top-left corner. Boards start there and grow right and down. Move other cards to the right to make room.

**I want different board icons.**
Right-click a board › **Change icon…** › **Use my own picture…** for one board. To replace an icon everywhere it's used, see the *Board icons* section of the Developer Guide (put your picture in the `board-icons` folder).

**I can't move a sketch; it draws instead.**
You're in drawing mode. Click **Done** (or press Esc) first, then drag it.

**I deleted something by mistake.**
Press **Ctrl+Z** straight away, or click **Undo** on the message at the bottom. Later on, open the **Recycle bin** (bin button at the bottom of the sidebar) and click **Restore**. Things stay there for 30 days.

**I've forgotten a board's password.**
Unfortunately it can't be opened without it; that's what keeps it private. If you have a **backup** from before the board was locked, you can restore that (Settings › Backups).

**I want my boards from last week back.**
**Settings › Backups** › pick a backup › **Restore**.

**Backups say they can't be saved.**
The backup folder may be on a drive that isn't connected. Plug it in, or choose another folder in Settings › Backups.

**Spelling isn't underlined.**
Check **Settings › Spelling** is on and the right language is chosen. On Windows/Linux the dictionary may need to download once (internet needed).

**A picture shows "Image file missing".**
The picture was removed from the **assets** folder. If you use sync, it may still be on its way from another computer; give it a minute. Otherwise copy it back from a backup, or delete the card and add the picture again.

**A link card has no preview.**
Some websites don't provide one, or block apps from reading them. Right-click › **Refresh preview** to try again. Check **Link previews** is on in Settings.

**An audio or video file says "Can't play this file".**
That format can't play inside the app. Right-click › **Open with default app**.

**Sync says "Sync problem".**
Click it to see the reason. Usually the sync folder can't be found: check the drive is connected and your sync service (Dropbox, OneDrive…) is running. Your work is safe on this computer and is shared when the folder is back.

**Changes from my other computer aren't showing.**
Check your sync service has finished copying (its own icon usually shows this). In **Settings › Sync**, check both computers chose the **same** folder and both appear in the list. **Sync now** checks immediately.

**The browser extension says "Can't reach Pocket-Canvas".**
Open the Pocket-Canvas app. If it's open, check **Settings › Browser extension** says *Ready*, and that the port there matches the extension's **Options**.

**The browser extension says "Not connected".**
Click its toolbar button, then **Connect**, and click **Allow** in Pocket-Canvas.

**My boards have disappeared.**
Pocket-Canvas reads from the data folder in [section 16](#16-undo-saving-and-your-data). If you've moved computer or reinstalled, copy your backup folder back into place. If the main file was ever damaged, the app automatically falls back to the **.bak** safety copy.

**Can I share a board with someone?**
Export it as a [PDF or picture](#20-exporting-pdf-picture-and-markdown) to send, or as Markdown. Live sharing with other people isn't built in yet.

**The app won't start on Linux.**
For the AppImage, make sure it's allowed to run as a program, and install `libfuse2` on Ubuntu 22.04 or newer ([section 1](#1-installing-pocket-canvas)).

---

## 24. Uninstalling

- **Windows:** **Settings → Apps → Installed apps**, find **Pocket-Canvas**, then **Uninstall**.
- **Linux (.deb):** in a Terminal, `sudo apt remove pocket-canvas`. **AppImage:** just delete the file.
- **macOS:** drag **Pocket-Canvas** from Applications to the Bin.
- **Browser extension:** right-click its toolbar button › **Remove from…** (or remove it on the browser's extensions page).

Uninstalling **doesn't delete your boards**. If you want those gone too, delete the data folder from [section 16](#16-undo-saving-and-your-data). If you used sync, you can also delete the **Pocket-Canvas Sync** folder.

---

## 25. The Android app

Pocket-Canvas also runs on Android phones and tablets (Android 7 or newer), with the same boards, cards, templates, comments, Recycle bin and password-protected boards. With sync, your phone and computers stay the same.

- **Installing** the app, and **setting up sync step by step** with the free Syncthing app, are covered in the [Android guide](ANDROID.md).
- **The sync folder** is chosen with Android's own folder picker, so Pocket-Canvas can only see that one folder. A Pocket-Canvas Server ([section 26](#26-sharing-boards-and-your-own-server)) works too.
- **Using it:**
  - drag one finger to move around, pinch to zoom, tap to select and tap again to edit
  - press and hold for the right-click menu
  - **☰** shows your boards; **⋮** has templates, export, the Recycle bin, backups and settings
  - **Back** closes windows and steps out of boards
- **Exports** (pictures, PDFs, Markdown and backups) open Android's share sheet.
- **Desktop only:** automatic backups to another folder, the browser extension and spelling settings.

---

## 26. Sharing boards and your own server

A **Pocket-Canvas Server** is a small program you (or someone you trust) run, for example on a home server. It does two things:

- **Keeps your boards in step on all your devices**: computers, Android, iPhone and iPad, without a sync folder.
- **Lets you share a board with other people** so you can work on it together, live.

Setting up the server is explained in [server/README.md](../server/README.md).

### Signing in
1. Open **Settings › Server**.
2. Type the server's address.
3. **The first time:** type a name, a password and the **join code** (ask whoever runs the server), then click **Create account**.
4. **On your other devices:** use the same name and password and click **Sign in**.

The top bar shows **● Live** while you're connected, or **Offline** while the server can't be reached. Changes made offline are sent when it's back.

**Keep all my boards in step through this server** is on unless you turn it off; it works alongside a sync folder if you have one.

### Sharing a board
1. Right-click a board's card (or the board in the sidebar) and choose **Share with people…**.
2. Tick the people to share with, and click **Share**.

The board appears on their Home board straight away, and boards inside it are shared too. Shared boards have a blue **people** badge.

### Working together
- **Changes appear for everyone in about a second.** The same goes for cards, lines, pictures and files.
- The **coloured initials** in the top bar show who else is on the board.
- The card someone is on is **outlined in their colour** with their name, plus **✎** while they're typing.
- **If two people change the same card at the same moment**, the later change wins. Changes to different cards are all kept.
- **While you're typing**, other people's changes wait until you finish, so your text isn't disturbed.

### Changing who it's shared with
- Right-click the board › **Shared with…**.
- **The owner** can tick or untick people, or **Stop sharing**.
- **Anyone else** can **Leave**.
- Everyone keeps their own copy, which carries on as a normal board.

Boards with a password can't be shared, and shared boards can't be given a password.

---

## 27. iPhone and iPad

Pocket-Canvas runs on iPhone and iPad (iOS 15 or newer), just like the Android app. It has touch gestures, the **⋮** menu, export through the share sheet, and Apple Pencil pressure in sketches.

- **Installing:** see the [iPhone and iPad guide](IOS.md). Until the app is in the App Store, you install it with your own Apple Account using a tool such as Sideloadly or AltStore, or from Xcode on a Mac.
- **Syncing:** use a Pocket-Canvas Server ([section 26](#26-sharing-boards-and-your-own-server)). iPhones and iPads don't have the shared folders that sync apps use.

---

## Need help?

Email **pocket-designs@proton.me**.

---

## 28. Using Pocket-Canvas in a web browser

If you have a **Pocket-Canvas Server** ([section 26](#26-sharing-boards-and-your-own-server)), you can use Pocket-Canvas in Chrome, Edge, Firefox or Safari on any computer, phone or tablet, with nothing to install.

1. Open the server's address, for example `https://boards.example.com`.
2. Sign in with your name and password, the same ones you use in the apps. To make an account, click **New here? Create an account** and enter the join code from whoever runs the server.
3. Your boards appear, copied from your other devices, and stay in step live. The top bar shows **● Live** while connected.

Everything works as in the desktop app, including sharing, tables, sketches, pictures, page guides and exporting. A few things are different:
- **The ⋮ button** (top right) has what the desktop menu bar has, including **Sign out**. The keyboard shortcuts work as in the desktop app.
- **Exports and backups** download to your Downloads folder.
- **Pictures and files** you add are uploaded to your server straight away.
- **Settings › Account** shows the server you're signed in to.
- There are no sync folders or folder backups; your server keeps everything in step.

On someone else's computer, use **⋮ › Sign out** when you finish. That also removes the copy of your boards kept in that browser.

