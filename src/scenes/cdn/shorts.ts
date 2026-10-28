/**
 * Vertical Shorts cut from the full "How a CDN Works" render. Each one starts
 * and ends on narration cue boundaries (see script.ts) so no line is cut off,
 * and stays under 60 s.
 */
import type { Short } from '../../components/Script.ts';

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
    beats: [
      { at: 216, text: 'Case 1 · HIT', color: '#34d399' },
      { at: 237, text: 'Case 2 · MISS', color: '#fbbf24' },
    ],
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
    hook: '4 times a CDN barely helps',
    beats: [
      { at: 336, text: '1/4 · Personal data', color: '#fbbf24' },
      { at: 356, text: '2/4 · Rarely requested files', color: '#fbbf24' },
      { at: 362, text: '3/4 · Users near the origin', color: '#fbbf24' },
      { at: 369, text: '4/4 · Slow backend', color: '#f87171' },
    ],
    title: "4 cases where a CDN barely helps",
    description:
      'Personal pages, rarely requested files, users already near the origin, and a slow backend. A CDN shortens the distance. It does not fix slow code.',
    hashtags: ['#cdn', '#cloudarchitecture', '#devops'],
  },
];
