// Icons drawn for Pocket-Connect (no third-party logos). OS icons are shown on device tiles.
(function (global) {
  'use strict';
  const S = (body, vb = '0 0 24 24') => `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

  const OS = {
    windows: {
      label: 'Windows',
      color: '#3b82f6',
      svg: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="9" width="34" height="26" rx="3" fill="currentColor" opacity=".18"/><rect x="7" y="9" width="34" height="26" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M7 15h34" stroke="currentColor" stroke-width="2.4"/><circle cx="11" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><rect x="13" y="19" width="9" height="5.5" rx="1" fill="currentColor"/><rect x="24" y="19" width="11" height="5.5" rx="1" fill="currentColor"/><rect x="13" y="26.5" width="9" height="5" rx="1" fill="currentColor"/><rect x="24" y="26.5" width="11" height="5" rx="1" fill="currentColor"/><path d="M18 41h12M24 35v6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    },
    linux: {
      label: 'Linux',
      color: '#f59e0b',
      svg: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5c-6 0-9 5-9 11 0 4-3 7-5 11-2.5 5-2 10 2 12l4 2h16l4-2c4-2 4.5-7 2-12-2-4-5-7-5-11 0-6-3-11-9-11z" fill="currentColor" opacity=".9"/><path d="M24 15c-4.5 0-7 4-7 9 0 6 3 12 7 12s7-6 7-12c0-5-2.5-9-7-9z" fill="var(--icon-face,#fff)"/><circle cx="20.5" cy="13" r="2" fill="var(--icon-face,#fff)"/><circle cx="27.5" cy="13" r="2" fill="var(--icon-face,#fff)"/><circle cx="20.8" cy="13.3" r=".9" fill="#111"/><circle cx="27.2" cy="13.3" r=".9" fill="#111"/><path d="M21 17l3 2.2 3-2.2-3-1.2z" fill="#f8b500"/><path d="M11 39c-2 1-3 3-1 4s6 1 8-1l-2-4zM37 39c2 1 3 3 1 4s-6 1-8-1l2-4z" fill="#f8b500"/></svg>`,
    },
    android: {
      label: 'Android',
      color: '#22c55e',
      svg: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="12" y="4" width="24" height="40" rx="4.5" fill="currentColor" opacity=".18"/><rect x="12" y="4" width="24" height="40" rx="4.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M21 40h6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M17 26a7 7 0 0 1 14 0z" fill="currentColor"/><path d="M19 17.5l1.6 2.6M29 17.5l-1.6 2.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="21.5" cy="23.3" r="1" fill="var(--icon-face,#fff)"/><circle cx="26.5" cy="23.3" r="1" fill="var(--icon-face,#fff)"/><rect x="17" y="27.5" width="14" height="6" rx="1.5" fill="currentColor"/></svg>`,
    },
    macos: {
      label: 'macOS',
      color: '#a1a1aa',
      svg: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="10" width="30" height="20" rx="2.5" fill="currentColor" opacity=".18"/><rect x="9" y="10" width="30" height="20" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M4 34h40l-3 4H7z" fill="currentColor"/><path d="M21 17.5a1.7 1.7 0 1 1 1.7 1.7H25.3a1.7 1.7 0 1 1 1.7-1.7v5a1.7 1.7 0 1 1-1.7-1.7H22.7a1.7 1.7 0 1 1-1.7 1.7z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
    },
    unknown: {
      label: 'Other',
      color: '#94a3b8',
      svg: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="9" width="34" height="24" rx="3" fill="currentColor" opacity=".18"/><rect x="7" y="9" width="34" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M18 41h12M24 33v8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M21 18a3 3 0 1 1 4 2.8c-.8.3-1 .8-1 1.7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/><circle cx="24" cy="26.5" r="1.3" fill="currentColor"/></svg>`,
    },
  };

  const UI = {
    desktop: S('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
    terminal: S('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>'),
    both: S('<rect x="2" y="3" width="14" height="10" rx="2"/><rect x="9" y="11" width="13" height="10" rx="2"/><path d="M12 15l2 1.5-2 1.5"/>'),
    phone: S('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
    folder: S('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    folderPlus: S('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10v6M9 13h6"/>'),
    plus: S('<path d="M12 5v14M5 12h14"/>'),
    search: S('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
    grid: S('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
    list: S('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
    copy: S('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
    refresh: S('<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>'),
    eye: S('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    lock: S('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    shield: S('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
    user: S('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    settings: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    radar: S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6-6"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
    activity: S('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
    more: S('<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>'),
    trash: S('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    edit: S('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>'),
    close: S('<path d="M6 6l12 12M18 6L6 18"/>'),
    chevron: S('<path d="M9 6l6 6-6 6"/>'),
    cloud: S('<path d="M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>'),
    wifi: S('<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/>'),
    usb: S('<path d="M12 3v15M12 3l-2 3h4zM8 10v3l4 3M16 9v3l-4 3"/><circle cx="12" cy="20" r="2"/><rect x="15" y="7" width="2.5" height="2.5"/><circle cx="8" cy="9" r="1.2"/>'),
    key: S('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>'),
    power: S('<path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"/>'),
    back: S('<path d="M15 6l-6 6 6 6"/>'),
    home: S('<circle cx="12" cy="12" r="7"/>'),
    recents: S('<rect x="5" y="5" width="14" height="14" rx="2"/>'),
    volup: S('<path d="M4 10v4h4l5 4V6L8 10zM17 9a4 4 0 0 1 0 6M15 12h0"/><path d="M19 4v4M17 6h4"/>'),
    voldown: S('<path d="M4 10v4h4l5 4V6L8 10zM17 9a4 4 0 0 1 0 6"/><path d="M17 6h4"/>'),
    keyboard: S('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h0M10 10h0M14 10h0M18 10h0M7 14h10"/>'),
    fullscreen: S('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    clipboard: S('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9z"/>'),
    screens: S('<rect x="2" y="5" width="12" height="9" rx="1.5"/><rect x="12" y="9" width="10" height="9" rx="1.5"/>'),
    gauge: S('<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>'),
    rotate: S('<path d="M4 4v6h6"/><path d="M20 12a8 8 0 0 0-14.3-5L4 10"/><rect x="11" y="13" width="9" height="7" rx="1"/>'),
    sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    link: S('<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>'),
  };

  global.PCIcons = { OS, UI, os: (k) => (OS[k] || OS.unknown) };
})(window);
