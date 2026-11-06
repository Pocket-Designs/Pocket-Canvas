/* Pocket-Canvas — board icons
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 *
 * These are the icons offered for boards (right-click a board card › Change icon…).
 *
 * TO USE YOUR OWN PICTURES:
 *   1. Put your picture in this folder (PNG, SVG, JPG or WebP; square, at least 128 × 128 px).
 *   2. Change the matching line's "file" to your picture's file name, e.g. file: 'home.png'.
 *      Keep the "id" the same and every board already using that icon updates automatically.
 *   3. To add a brand-new icon, add a line with a new id. Don't remove lines that boards use;
 *      a board whose icon id is missing falls back to the first icon in the list.
 *   "tint": true means the icon sits on the board's colour (white line icons).
 *   Set tint: false for full-colour pictures that should fill the tile instead.
 */
'use strict';
const BOARD_ICONS = [
  { id: 'board', name: 'Board', file: 'board.svg' },
  { id: 'home', name: 'Home', file: 'home.svg' },
  { id: 'star', name: 'Star', file: 'star.svg' },
  { id: 'heart', name: 'Heart', file: 'heart.svg' },
  { id: 'idea', name: 'Idea', file: 'idea.svg' },
  { id: 'target', name: 'Goals', file: 'target.svg' },
  { id: 'checklist', name: 'Checklist', file: 'checklist.svg' },
  { id: 'calendar', name: 'Calendar', file: 'calendar.svg' },
  { id: 'clock', name: 'Time', file: 'clock.svg' },
  { id: 'rocket', name: 'Project', file: 'rocket.svg' },
  { id: 'chart', name: 'Chart', file: 'chart.svg' },
  { id: 'work', name: 'Work', file: 'work.svg' },
  { id: 'folder', name: 'Folder', file: 'folder.svg' },
  { id: 'book', name: 'Reading', file: 'book.svg' },
  { id: 'school', name: 'Study', file: 'school.svg' },
  { id: 'pen', name: 'Writing', file: 'pen.svg' },
  { id: 'palette', name: 'Art', file: 'palette.svg' },
  { id: 'camera', name: 'Photos', file: 'camera.svg' },
  { id: 'film', name: 'Video', file: 'film.svg' },
  { id: 'music', name: 'Music', file: 'music.svg' },
  { id: 'game', name: 'Games', file: 'game.svg' },
  { id: 'code', name: 'Code', file: 'code.svg' },
  { id: 'tools', name: 'Tools', file: 'tools.svg' },
  { id: 'chat', name: 'Chat', file: 'chat.svg' },
  { id: 'mail', name: 'Mail', file: 'mail.svg' },
  { id: 'person', name: 'Person', file: 'person.svg' },
  { id: 'people', name: 'People', file: 'people.svg' },
  { id: 'globe', name: 'World', file: 'globe.svg' },
  { id: 'map', name: 'Travel', file: 'map.svg' },
  { id: 'pin', name: 'Places', file: 'pin.svg' },
  { id: 'leaf', name: 'Nature', file: 'leaf.svg' },
  { id: 'sun', name: 'Summer', file: 'sun.svg' },
  { id: 'moon', name: 'Night', file: 'moon.svg' },
  { id: 'coffee', name: 'Coffee', file: 'coffee.svg' },
  { id: 'food', name: 'Food', file: 'food.svg' },
  { id: 'shopping', name: 'Shopping', file: 'shopping.svg' },
  { id: 'gift', name: 'Gifts', file: 'gift.svg' },
  { id: 'money', name: 'Money', file: 'money.svg' },
  { id: 'fitness', name: 'Fitness', file: 'fitness.svg' },
  { id: 'pet', name: 'Pets', file: 'pet.svg' },
  { id: 'lock', name: 'Private', file: 'lock.svg' },
  { id: 'flag', name: 'Milestones', file: 'flag.svg' }
].map((i) => ({ tint: true, ...i }));
