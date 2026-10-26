# How a CDN Works — script & beats

Format: concept explainer · 7:00 · 1920×1080 @ 30 fps.
Source of truth for timing: `script.ts` (drives animation beats and the `.srt` export).
Edit narration there, then re-render; this file is a readable copy for voiceover recording.

## Visual beats

| Time | Stage | Beat |
|---|---|---|
| 0:00–0:05 | Map | Title card over world map, edges + users pulse (teaser) |
| 0:05–0:20 | Map | Berlin user ↔ Virginia origin, ≈6,700 km arc; Frankfurt edge answers instantly |
| 0:20–0:48 | Map | Every request crosses the Atlantic; slow-motion packet; RTT callout |
| 0:48–1:12 | Map | 4 round trips stack up in panel → ≈400 ms |
| 1:12–1:30 | Map | Tokyo, São Paulo, Sydney join; origin turns yellow under load |
| 1:30–2:17 | Map | Edges pop in worldwide (PoPs); Frankfurt cache fills; origin → edge copies |
| 2:17–3:01 | Map | Routing: DNS answers differ for Berlin vs Tokyo; Anycast same IP everywhere |
| 3:01–3:30 | Map | Berlin ↔ Frankfurt; ~100 ms vs ~10 ms, 400 vs 40 ms panel |
| 3:30–3:57 | Diagram | HIT: logo.png served from edge, origin idle |
| 3:57–4:32 | Diagram | MISS: hero.jpg fetched from origin, cached, next user HITs |
| 4:32–5:30 | Diagram | max-age ring drains → revalidate → 304 / 200; purge; versioned filenames |
| 5:30–6:30 | Diagram | BYPASS (private/no-store), cold cache, user near origin, slow DB |
| 6:30–7:00 | Map | Recap checklist, next video card, question |

## Fact notes

- Berlin ↔ Ashburn, Virginia great-circle ≈ 6,727 km; Berlin ↔ Frankfurt ≈ 423 km.
- Light in fiber ≈ 200,000 km/s (refractive index ≈ 1.47 → ~0.68 c). Theoretical RTT Berlin–Virginia ≈ 67 ms; real paths are longer, so ~90–100 ms is typical.
- TCP handshake = 1 RTT; TLS 1.3 handshake = 1 RTT (TLS 1.2: 2). The 4-trip, ~100 ms example is labeled "example" on screen.
- `Cache-Control: private` forbids shared caches (CDNs) from storing; `no-store` forbids any cache.
- Revalidation: `If-None-Match` with the ETag → `304 Not Modified` (no body) or `200` with the new file.
- IPs shown are RFC 5737 documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24).
- Anycast + BGP routes to the nearest location *in network terms* (path selection), not strictly geographic.

## Narration

### 0:00–0:20 · Hook

| Time | Narration |
|---|---|
| 0:00 | Why does a website load fast, even when its server is on the other side of the world? |
| 0:05 | Say you're in Berlin. The site you open is hosted in Virginia, about 6,700 kilometers away. |
| 0:11 | Yet the page appears almost instantly. The trick is called a CDN. |
| 0:15 | A Content Delivery Network. Let's see how it works. |

### 0:20–1:30 · The problem: distance

| Time | Narration |
|---|---|
| 0:20 | First, the problem. Without a CDN, every request goes all the way to one server: the origin. |
| 0:26 | The origin is where your website actually lives: your files, your app, your database. |
| 0:32 | Data travels through fiber-optic cables at roughly 200,000 kilometers per second. |
| 0:39 | Fast, but not instant. A round trip from Berlin to Virginia takes about 70 milliseconds in theory, and often closer to 100 in practice. |
| 0:48 | And opening a page takes several round trips. |
| 0:53 | One to open a connection. One more to set up encryption. Then one for the HTML itself. |
| 1:00 | Then more for the styles, scripts and images that the HTML points to. |
| 1:06 | Before anything appears on screen, hundreds of milliseconds are gone. |
| 1:12 | Now add users in Tokyo, São Paulo and Sydney, all hitting the same origin. |
| 1:19 | They're even farther away, so they wait even longer. |
| 1:25 | And the origin has to answer every single request by itself. |

### 1:30–3:30 · How a CDN works

| Time | Narration |
|---|---|
| 1:30 | A CDN fixes this by moving content closer to users. |
| 1:36 | It's a network of servers spread around the world, called edge servers. |
| 1:43 | They sit in locations called Points of Presence, or PoPs. Large CDNs run hundreds of them. |
| 1:50 | For our user in Berlin, there's an edge server right next door, in Frankfurt. |
| 1:57 | Each edge server keeps a cache: copies of your files, stored close to the people who need them. |
| 2:04 | Images, stylesheets, JavaScript, fonts, video segments: anything that's the same for every visitor. |
| 2:11 | The origin is still the source of truth. The edges just keep copies. |
| 2:17 | But how does a request from Berlin know to go to Frankfurt, and not to Tokyo? |
| 2:24 | That's routing. CDNs commonly use two techniques. |
| 2:30 | The first is DNS. When your browser looks up the site's name, the CDN's DNS server answers with the address of a nearby edge. |
| 2:39 | A user in Tokyo asks the same question, and gets a different answer: the Tokyo edge. |
| 2:46 | The second is Anycast. Many edge servers announce the very same IP address. |
| 2:53 | The internet's routing system, BGP, then delivers each request to the nearest location, in network terms. |
| 3:01 | Either way, the user lands on a nearby edge. Berlin to Frankfurt is just over 400 kilometers. |
| 3:08 | Instead of crossing an ocean, a round trip there often takes around 10 milliseconds. |
| 3:16 | And every one of those connection steps now happens close to home. |
| 3:23 | The connection, the encryption, and the cached files: all handled by the edge. |

### 3:30–5:30 · Cache hit, miss & refresh

| Time | Narration |
|---|---|
| 3:30 | So what happens when a request reaches the edge? There are two possibilities. |
| 3:36 | Case one: a cache hit. The user in Berlin asks for logo.png. |
| 3:43 | Frankfurt already has a copy, and sends it right back. The origin isn't involved at all. |
| 3:50 | That's the fast path, and a CDN tries to make it as common as possible. |
| 3:57 | Case two: a cache miss. A user in Tokyo asks for a new file, hero.jpg. |
| 4:04 | The Tokyo edge doesn't have it yet, so it forwards the request to the origin. |
| 4:11 | The origin sends the file back. The edge delivers it to the user, and keeps a copy. |
| 4:19 | The next user in Tokyo who asks for hero.jpg gets a cache hit. |
| 4:26 | A miss costs one long trip. After that, everyone nearby benefits. |
| 4:32 | But what if you change the file? Copies can't live forever. |
| 4:39 | The origin sets a lifetime with a header: Cache-Control, max-age. For example, one hour. |
| 4:47 | While that timer runs, the edge serves its copy without asking. |
| 4:54 | When it expires, the edge checks back with the origin: has this file changed? |
| 5:02 | If not, the origin replies with a tiny 304 Not Modified, and the timer starts again. |
| 5:09 | If it has changed, the edge downloads the new version. |
| 5:16 | Need an update right now? You can purge the cache, and the edges drop their old copies. |
| 5:23 | Many teams also put a version in the file name, like app.v2.js, so new files never clash with old ones. |

### 5:30–6:30 · When a CDN doesn't help

| Time | Narration |
|---|---|
| 5:30 | A CDN is powerful, but it's not magic. Here's when it doesn't help much. |
| 5:36 | Personal data. Your shopping cart or account page is different for every user. |
| 5:43 | The origin marks it private, or no-store, so the edge passes the request through to the origin. |
| 5:50 | The edge can keep its connection to the origin warm, but the origin still does the work. |
| 5:56 | Rarely requested files. If almost nobody asks for something, the cache is usually cold. |
| 6:02 | Users near the origin. Someone in Washington is already close to Virginia, so the gain is small. |
| 6:09 | And a slow backend. If every response needs two seconds of database work, the CDN can't speed that part up. |
| 6:16 | A CDN shortens the distance. It doesn't fix slow code. |
| 6:23 | Uncacheable, rarely used, already nearby, or slow at the source: look elsewhere. |

### 6:30–7:00 · Recap

| Time | Narration |
|---|---|
| 6:30 | So, let's recap. |
| 6:35 | A CDN puts edge servers close to your users, and DNS or Anycast sends each user to a nearby one. |
| 6:41 | A cache hit is served from the edge. A miss goes to the origin once, then gets cached. |
| 6:47 | Lifetimes, revalidation and purging keep the copies fresh. |
| 6:52 | Next up: load balancers, and how one site spreads traffic across many servers. |
| 6:56 | What's in your Cache-Control headers? Tell me in the comments. |

