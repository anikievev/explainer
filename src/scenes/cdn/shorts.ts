/**
 * Vertical Shorts cut from the full "How a CDN Works" render. Each one starts
 * and ends on narration cue boundaries (see script.ts) so no line is cut off,
 * and stays under 60 s.
 */
export interface Short {
  slug: string;
  /** Video time range in seconds. */
  start: number;
  end: number;
  /** Big on-screen title, shown for the whole Short. */
  hook: string;
  /** YouTube title (≤ 100 characters, #Shorts added automatically). */
  title: string;
  description: string;
  hashtags: string[];
}

export const SHORTS: Short[] = [
  {
    slug: 'why-distance-is-slow',
    start: 20,
    end: 72,
    hook: 'Why far-away websites feel slow',
    title: 'Why a website 6,700 km away feels slow',
    description:
      'A user in Berlin, a server in Virginia, and several round trips before the page even starts to draw. Light in fiber is fast, but distance still adds up.',
    hashtags: ['#webperformance', '#latency', '#networking'],
  },
  {
    slug: 'dns-vs-anycast',
    start: 137,
    end: 196,
    hook: 'How your request finds the nearest server',
    title: 'How a CDN sends you to the nearest server: DNS vs. Anycast',
    description:
      'Berlin goes to Frankfurt, Tokyo goes to Tokyo. Two ways a CDN routes each user to a nearby edge server: DNS answers and Anycast with BGP.',
    hashtags: ['#cdn', '#dns', '#anycast'],
  },
  {
    slug: 'cache-hit-vs-miss',
    start: 216,
    end: 272,
    hook: 'Cache HIT vs. cache MISS',
    title: 'Cache HIT vs. cache MISS, explained in under a minute',
    description:
      'logo.png is already at the Frankfurt edge, so it comes straight back. hero.jpg is new in Tokyo, so the edge fetches it from the origin once and keeps a copy for everyone after.',
    hashtags: ['#cdn', '#caching', '#systemdesign'],
  },
  {
    slug: 'keeping-caches-fresh',
    start: 272,
    end: 330,
    hook: 'How CDNs keep cached files fresh',
    title: 'Cache-Control, 304 Not Modified and purging: how CDN caches stay fresh',
    description:
      'A max-age timer, a quick check with the origin when it runs out, a purge when you need it now, and versioned file names like app.v2.js.',
    hashtags: ['#cdn', '#http', '#webdev'],
  },
  {
    slug: 'when-a-cdn-doesnt-help',
    start: 330,
    end: 383,
    hook: "When a CDN doesn't help",
    title: "4 cases where a CDN barely helps",
    description:
      'Personal pages, rarely requested files, users already near the origin, and a slow backend. A CDN shortens the distance. It does not fix slow code.',
    hashtags: ['#cdn', '#cloudarchitecture', '#devops'],
  },
];
