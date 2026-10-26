/** Shared color language across all videos (see CLAUDE.md). */
export const COLORS = {
  background: 0x05080f,
  fog: 0x05080f,
  ocean: 0x0a1424,
  oceanGrid: 0x13233b,
  land: 0x1a2a40,
  landEdge: 0x3a5a85,

  healthy: 0x34d399, // green
  warning: 0xfbbf24, // yellow
  failure: 0xf87171, // red
  network: 0x38bdf8, // blue — data flow
  storage: 0xa78bfa, // purple — storage / database

  server: 0xcbd5e1,
  serverDark: 0x334155,
  edge: 0x22d3ee,
  user: 0xf1f5f9,
  white: 0xffffff,
} as const;

export const CSS = {
  text: '#f1f5f9',
  muted: '#94a3b8',
  panel: 'rgba(10, 18, 32, 0.82)',
  panelBorder: 'rgba(148, 163, 184, 0.28)',
  healthy: '#34d399',
  warning: '#fbbf24',
  failure: '#f87171',
  network: '#38bdf8',
  storage: '#a78bfa',
  edge: '#22d3ee',
} as const;

export const FONTS = {
  sans: 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
  mono: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
} as const;
