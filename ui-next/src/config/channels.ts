// src/config/channels.ts
// M. Osei, 2023-07 — the five series channels the /api/series rows carry.
// Colours here match the --ch-* custom properties in global.css.

import type { SeriesChannelMeta } from '../api/types';

export const CHANNEL_META: SeriesChannelMeta[] = [
  { key: 'sw', label: 'Soil water', unit: 'mm', color: '#2f6fb0' },
  { key: 'et', label: 'ET', unit: 'mm/d', color: '#b7791f' },
  { key: 'drain', label: 'Drainage', unit: 'mm/d', color: '#7a8a57' },
  { key: 'biom', label: 'Biomass', unit: 'kg/ha', color: '#2f7d4f' },
  { key: 'lai', label: 'LAI', unit: '', color: '#8a5a9c' },
];
