/**
 * Map positions [lon, lat]. Users are nudged a few degrees away from the
 * nearest edge city so the two figures don't overlap on the overview map.
 */
export const ORIGIN_VIRGINIA: [number, number] = [-77.5, 39.0];

export const USERS = {
  berlin: { name: 'Berlin', lonLat: [15.5, 54.0] as [number, number] },
  tokyo: { name: 'Tokyo', lonLat: [143.5, 41.5] as [number, number] },
  saoPaulo: { name: 'São Paulo', lonLat: [-51, -16] as [number, number] },
  sydney: { name: 'Sydney', lonLat: [145, -28] as [number, number] },
};

export type UserKey = keyof typeof USERS;

export const EDGES = {
  madrid: { name: 'Madrid', lonLat: [-3.7, 40.4] as [number, number] },
  frankfurt: { name: 'Frankfurt', lonLat: [8.7, 50.1] as [number, number] },
  dallas: { name: 'Dallas', lonLat: [-96.8, 32.8] as [number, number] },
  losAngeles: { name: 'Los Angeles', lonLat: [-118.2, 34.0] as [number, number] },
  saoPaulo: { name: 'São Paulo', lonLat: [-46.6, -23.5] as [number, number] },
  johannesburg: { name: 'Johannesburg', lonLat: [28.0, -26.2] as [number, number] },
  mumbai: { name: 'Mumbai', lonLat: [72.9, 19.1] as [number, number] },
  singapore: { name: 'Singapore', lonLat: [103.8, 1.35] as [number, number] },
  tokyo: { name: 'Tokyo', lonLat: [139.7, 35.7] as [number, number] },
  sydney: { name: 'Sydney', lonLat: [151.2, -33.9] as [number, number] },
};

export type EdgeKey = keyof typeof EDGES;

/** Which edge each user is routed to. */
export const NEAREST_EDGE: Record<UserKey, EdgeKey> = {
  berlin: 'frankfurt',
  tokyo: 'tokyo',
  saoPaulo: 'saoPaulo',
  sydney: 'sydney',
};

/** Order in which edges pop onto the map. */
export const EDGE_ORDER: EdgeKey[] = [
  'frankfurt', 'madrid', 'dallas', 'losAngeles', 'saoPaulo', 'johannesburg', 'mumbai', 'singapore', 'tokyo', 'sydney',
];

export const DNS_EUROPE: [number, number] = [24, 58];
export const DNS_ASIA: [number, number] = [130, 46];

/** Documentation-range IPs (RFC 5737), never real addresses. */
export const IPS = {
  frankfurt: '203.0.113.10',
  tokyo: '198.51.100.20',
  anycast: '192.0.2.1',
};
