/**
 * "How a CDN Works" — narration script. Times are in seconds and drive both
 * the animation beats in CdnScene and the exported .srt captions.
 * Target pace: ~2.5 words/second.
 */

export interface Cue {
  start: number;
  end: number;
  text: string;
}

export interface Section {
  start: number;
  end: number;
  index: string;
  title: string;
}

export const DURATION = 420;

export const SECTIONS: Section[] = [
  { start: 0, end: 20, index: '', title: 'Hook' },
  { start: 20, end: 90, index: '1', title: 'The problem: distance' },
  { start: 90, end: 210, index: '2', title: 'How a CDN works' },
  { start: 210, end: 330, index: '3', title: 'Cache hit, miss & refresh' },
  { start: 330, end: 390, index: '4', title: "When a CDN doesn't help" },
  { start: 390, end: 420, index: '✓', title: 'Recap' },
];

export const CUES: Cue[] = [
  // 0:00–0:20 — Hook
  { start: 0.3, end: 5.5, text: 'Why does a website load fast, even when its server is on the other side of the world?' },
  { start: 5.5, end: 11, text: "Say you're in Berlin. The site you open is hosted in Virginia, about 6,700 kilometers away." },
  { start: 11, end: 15.5, text: 'Yet the page appears almost instantly. The trick is called a CDN.' },
  { start: 15.5, end: 20, text: "A Content Delivery Network. Let's see how it works." },

  // 0:20–1:30 — The problem
  { start: 20, end: 26, text: 'First, the problem. Without a CDN, every request goes all the way to one server: the origin.' },
  { start: 26, end: 32, text: 'The origin is where your website actually lives: your files, your app, your database.' },
  { start: 32, end: 39, text: 'Data travels through fiber-optic cables at roughly 200,000 kilometers per second.' },
  { start: 39, end: 48, text: 'Fast, but not instant. A round trip from Berlin to Virginia takes about 70 milliseconds in theory, and often closer to 100 in practice.' },
  { start: 48, end: 53, text: 'And opening a page takes several round trips.' },
  { start: 53, end: 60, text: 'One to open a connection. One more to set up encryption. Then one for the HTML itself.' },
  { start: 60, end: 66, text: 'Then more for the styles, scripts and images that the HTML points to.' },
  { start: 66, end: 72, text: 'Before anything appears on screen, hundreds of milliseconds are gone.' },
  { start: 72, end: 79, text: 'Now add users in Tokyo, São Paulo and Sydney, all hitting the same origin.' },
  { start: 79, end: 85, text: "They're even farther away, so they wait even longer." },
  { start: 85, end: 90, text: 'And the origin has to answer every single request by itself.' },

  // 1:30–3:30 — How a CDN works
  { start: 90, end: 96, text: 'A CDN fixes this by moving content closer to users.' },
  { start: 96, end: 103, text: "It's a network of servers spread around the world, called edge servers." },
  { start: 103, end: 110, text: 'They sit in locations called Points of Presence, or PoPs. Large CDNs run hundreds of them.' },
  { start: 110, end: 117, text: "For our user in Berlin, there's an edge server right next door, in Frankfurt." },
  { start: 117, end: 124, text: 'Each edge server keeps a cache: copies of your files, stored close to the people who need them.' },
  { start: 124, end: 131, text: "Images, stylesheets, JavaScript, fonts, video segments: anything that's the same for every visitor." },
  { start: 131, end: 137, text: 'The origin is still the source of truth. The edges just keep copies.' },
  { start: 137, end: 144, text: 'But how does a request from Berlin know to go to Frankfurt, and not to Tokyo?' },
  { start: 144, end: 150, text: "That's routing. CDNs commonly use two techniques." },
  { start: 150, end: 159, text: "The first is DNS. When your browser looks up the site's name, the CDN's DNS server answers with the address of a nearby edge." },
  { start: 159, end: 166, text: 'A user in Tokyo asks the same question, and gets a different answer: the Tokyo edge.' },
  { start: 166, end: 173, text: 'The second is Anycast. Many edge servers announce the very same IP address.' },
  { start: 173, end: 181, text: "The internet's routing system, BGP, then delivers each request to the nearest location, in network terms." },
  { start: 181, end: 188, text: 'Either way, the user lands on a nearby edge. Berlin to Frankfurt is just over 400 kilometers.' },
  { start: 188, end: 196, text: 'Instead of crossing an ocean, a round trip there often takes around 10 milliseconds.' },
  { start: 196, end: 203, text: 'And every one of those connection steps now happens close to home.' },
  { start: 203, end: 210, text: 'The connection, the encryption, and the cached files: all handled by the edge.' },

  // 3:30–5:30 — Hit, miss, refresh
  { start: 210, end: 216, text: 'So what happens when a request reaches the edge? There are two possibilities.' },
  { start: 216, end: 223, text: 'Case one: a cache hit. The user in Berlin asks for logo.png.' },
  { start: 223, end: 230, text: "Frankfurt already has a copy, and sends it right back. The origin isn't involved at all." },
  { start: 230, end: 237, text: "That's the fast path, and a CDN tries to make it as common as possible." },
  { start: 237, end: 244, text: 'Case two: a cache miss. A user in Tokyo asks for a new file, hero.jpg.' },
  { start: 244, end: 251, text: "The Tokyo edge doesn't have it yet, so it forwards the request to the origin." },
  { start: 251, end: 259, text: 'The origin sends the file back. The edge delivers it to the user, and keeps a copy.' },
  { start: 259, end: 266, text: 'The next user in Tokyo who asks for hero.jpg gets a cache hit.' },
  { start: 266, end: 272, text: 'A miss costs one long trip. After that, everyone nearby benefits.' },
  { start: 272, end: 279, text: "But what if you change the file? Copies can't live forever." },
  { start: 279, end: 287, text: 'The origin sets a lifetime with a header: Cache-Control, max-age. For example, one hour.' },
  { start: 287, end: 294, text: 'While that timer runs, the edge serves its copy without asking.' },
  { start: 294, end: 302, text: 'When it expires, the edge checks back with the origin: has this file changed?' },
  { start: 302, end: 309, text: 'If not, the origin replies with a tiny 304 Not Modified, and the timer starts again.' },
  { start: 309, end: 316, text: 'If it has changed, the edge downloads the new version.' },
  { start: 316, end: 323, text: 'Need an update right now? You can purge the cache, and the edges drop their old copies.' },
  { start: 323, end: 330, text: 'Many teams also put a version in the file name, like app.v2.js, so new files never clash with old ones.' },

  // 5:30–6:30 — When a CDN doesn't help
  { start: 330, end: 336, text: "A CDN is powerful, but it's not magic. Here's when it doesn't help much." },
  { start: 336, end: 343, text: 'Personal data. Your shopping cart or account page is different for every user.' },
  { start: 343, end: 350, text: 'The origin marks it private, or no-store, so the edge passes the request through to the origin.' },
  { start: 350, end: 356, text: 'The edge can keep its connection to the origin warm, but the origin still does the work.' },
  { start: 356, end: 362, text: 'Rarely requested files. If almost nobody asks for something, the cache is usually cold.' },
  { start: 362, end: 369, text: 'Users near the origin. Someone in Washington is already close to Virginia, so the gain is small.' },
  { start: 369, end: 376, text: "And a slow backend. If every response needs two seconds of database work, the CDN can't speed that part up." },
  { start: 376, end: 383, text: "A CDN shortens the distance. It doesn't fix slow code." },
  { start: 383, end: 390, text: 'Uncacheable, rarely used, already nearby, or slow at the source: look elsewhere.' },

  // 6:30–7:00 — Recap
  { start: 390, end: 395, text: "So, let's recap." },
  { start: 395, end: 401, text: 'A CDN puts edge servers close to your users, and DNS or Anycast sends each user to a nearby one.' },
  { start: 401, end: 407, text: 'A cache hit is served from the edge. A miss goes to the origin once, then gets cached.' },
  { start: 407, end: 412, text: 'Lifetimes, revalidation and purging keep the copies fresh.' },
  { start: 412, end: 416, text: 'Next up: load balancers, and how one site spreads traffic across many servers.' },
  { start: 416, end: 420, text: "What's in your Cache-Control headers? Tell me in the comments." },
];

export function cueAt(t: number): Cue | undefined {
  return CUES.find((c) => t >= c.start && t < c.end);
}

export function sectionAt(t: number): Section {
  return SECTIONS.find((s) => t >= s.start && t < s.end) ?? SECTIONS[SECTIONS.length - 1];
}

const srtTime = (s: number) => {
  const ms = Math.round(s * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
};

export function toSrt(cues: Cue[] = CUES): string {
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n');
}
