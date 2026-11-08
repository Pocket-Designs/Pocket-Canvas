// Injects mouse and keyboard events on the host. Coordinates arrive normalised (0..1) to the
// screen being shared and are mapped to that display's position on the desktop.
const { screen } = require('electron');

let nut = null;
let loadError = null;
try {
  nut = require('@nut-tree-fork/nut-js');
  nut.mouse.config.autoDelayMs = 0;
  nut.mouse.config.mouseSpeed = 100000;
  nut.keyboard.config.autoDelayMs = 0;
} catch (err) {
  loadError = err;
}

// KeyboardEvent.code -> nut-js Key name
const CODE_MAP = {
  Escape: 'Escape', Backquote: 'Grave', Minus: 'Minus', Equal: 'Equal', Backspace: 'Backspace',
  Tab: 'Tab', BracketLeft: 'LeftBracket', BracketRight: 'RightBracket', Backslash: 'Backslash',
  IntlBackslash: 'Backslash', CapsLock: 'CapsLock', Semicolon: 'Semicolon', Quote: 'Quote',
  Enter: 'Enter', NumpadEnter: 'Enter', ShiftLeft: 'LeftShift', ShiftRight: 'RightShift',
  Comma: 'Comma', Period: 'Period', Slash: 'Slash', ControlLeft: 'LeftControl',
  ControlRight: 'RightControl', AltLeft: 'LeftAlt', AltRight: 'RightAlt', MetaLeft: 'LeftSuper',
  MetaRight: 'RightSuper', OSLeft: 'LeftSuper', OSRight: 'RightSuper', Space: 'Space',
  ContextMenu: 'Menu', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'PageUp',
  PageDown: 'PageDown', PrintScreen: 'Print', ScrollLock: 'ScrollLock', Pause: 'Pause',
  NumLock: 'NumLock', NumpadDivide: 'Divide', NumpadMultiply: 'Multiply',
  NumpadSubtract: 'Subtract', NumpadAdd: 'Add', NumpadDecimal: 'Decimal', NumpadEqual: 'NumPadEqual',
};
for (let i = 0; i <= 9; i++) {
  CODE_MAP[`Digit${i}`] = `Num${i}`;
  CODE_MAP[`Numpad${i}`] = `NumPad${i}`;
}
for (let i = 1; i <= 24; i++) CODE_MAP[`F${i}`] = `F${i}`;
for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') CODE_MAP[`Key${c}`] = c;

const BUTTONS = ['LEFT', 'MIDDLE', 'RIGHT'];
const held = new Set();
let queue = Promise.resolve();
let lastMove = null;

function displayFor(displayId) {
  const all = screen.getAllDisplays();
  return all.find((d) => String(d.id) === String(displayId)) || screen.getPrimaryDisplay();
}

function toDesktopPoint(displayId, nx, ny) {
  const d = displayFor(displayId);
  const x = d.bounds.x + Math.max(0, Math.min(1, nx)) * d.bounds.width;
  const y = d.bounds.y + Math.max(0, Math.min(1, ny)) * d.bounds.height;
  if (process.platform === 'win32' && screen.dipToScreenPoint) {
    return screen.dipToScreenPoint({ x, y });
  }
  const f = process.platform === 'linux' ? 1 : d.scaleFactor;
  return { x: Math.round(x * f), y: Math.round(y * f) };
}

function run(fn) {
  queue = queue.then(fn).catch((err) => console.warn('input:', err.message));
  return queue;
}

// msg: [kind, ...args]
function handle(displayId, msg) {
  if (!nut || !Array.isArray(msg)) return;
  const [kind, a, b, c] = msg;
  switch (kind) {
    case 'm': {
      // coalesce mouse moves: only the most recent position matters
      const first = !lastMove;
      lastMove = toDesktopPoint(displayId, a, b);
      if (first) {
        run(async () => {
          const p = lastMove;
          lastMove = null;
          if (p) await nut.mouse.setPosition(new nut.Point(p.x, p.y));
        });
      }
      return;
    }
    case 'd':
    case 'u': {
      const btn = nut.Button[BUTTONS[a] || 'LEFT'];
      return run(() => (kind === 'd' ? nut.mouse.pressButton(btn) : nut.mouse.releaseButton(btn)));
    }
    case 'w': {
      const dx = Math.round(a || 0);
      const dy = Math.round(b || 0);
      return run(async () => {
        if (dy) await (dy > 0 ? nut.mouse.scrollDown(Math.min(Math.abs(dy), 20)) : nut.mouse.scrollUp(Math.min(Math.abs(dy), 20)));
        if (dx) await (dx > 0 ? nut.mouse.scrollRight(Math.min(Math.abs(dx), 20)) : nut.mouse.scrollLeft(Math.min(Math.abs(dx), 20)));
      });
    }
    case 'kd':
    case 'ku': {
      const name = CODE_MAP[a];
      if (!name || nut.Key[name] === undefined) return;
      const key = nut.Key[name];
      if (kind === 'kd') held.add(key);
      else held.delete(key);
      return run(() => (kind === 'kd' ? nut.keyboard.pressKey(key) : nut.keyboard.releaseKey(key)));
    }
    case 't': // text typed from a phone keyboard
      if (typeof a === 'string' && a.length <= 1000) return run(() => nut.keyboard.type(a));
      return;
    case 'combo': {
      // e.g. ['combo', ['ControlLeft','AltLeft','Delete']]
      const keys = (Array.isArray(a) ? a : []).map((c2) => nut.Key[CODE_MAP[c2]]).filter((k) => k !== undefined);
      if (!keys.length) return;
      return run(async () => {
        await nut.keyboard.pressKey(...keys);
        await nut.keyboard.releaseKey(...keys);
      });
    }
    default:
  }
  void c;
}

// Release anything still held when a session ends so the host is not left with a stuck key.
function releaseAll() {
  if (!nut) return;
  const keys = [...held];
  held.clear();
  run(async () => {
    for (const k of keys) await nut.keyboard.releaseKey(k);
    for (const b of BUTTONS) await nut.mouse.releaseButton(nut.Button[b]).catch(() => {});
  });
}

module.exports = { handle, releaseAll, available: () => !!nut, loadError: () => loadError && loadError.message };
