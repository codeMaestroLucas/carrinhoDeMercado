export const CHART_GRID_PROPS = {
  strokeDasharray: '3 3',
  vertical: false,
  stroke: 'var(--border-subtle)',
} as const;

export const CHART_AXIS_TICK_STYLE = {
  fontSize: 10,
  fill: 'var(--text-muted)',
} as const;

export const CHART_TOOLTIP_CLASS =
  'bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 shadow-lg text-xs';
