# YouTube metadata — How a CDN Works

Channel: **Data Packet** · *Small packets. Big ideas.*
Files: `output/renders/how-a-cdn-works-1080p-voiced.mp4` · captions `output/renders/how-a-cdn-works.srt`

## Title

Primary (58 chars):

```
How a CDN Works: Why Websites Load Fast Across the World
```

Alternatives for A/B testing (YouTube "Test & compare"):

```
How a CDN Actually Works (Cache Hit, Miss & Anycast Explained)
Why a Site in Virginia Loads Fast in Berlin (CDNs Explained)
CDN Explained Visually: Edge Servers, Caching & Routing
```

## Description

```
A site hosted in Virginia opens almost instantly in Berlin, 6,700 km away. A CDN (Content Delivery Network) makes that possible. This 7-minute animation follows one request from Berlin to a nearby edge server in Frankfurt and back, then shows what happens when that server doesn't have the file yet.

What you'll see:
• Why one page load from Berlin to Virginia burns hundreds of milliseconds before anything appears
• How edge servers in Points of Presence (PoPs) keep copies of images, CSS, JavaScript and fonts close to users
• How DNS and Anycast (with BGP) send a user in Berlin to Frankfurt and a user in Tokyo to Tokyo
• A cache HIT for logo.png and a cache MISS for hero.jpg, step by step
• How Cache-Control max-age, ETag revalidation (304 Not Modified) and purging keep copies fresh
• Why many teams rename app.js to app.v2.js on each release
• Four cases where a CDN barely helps: personal pages, rarely requested files, users already near the origin, and a slow backend

⏱️ Chapters
0:00 Why websites load fast worldwide
0:20 The problem: distance and latency
0:48 Why one page needs many round trips
1:12 One origin, users everywhere
1:30 What a CDN is: edge servers and PoPs
1:57 Caching at the edge
2:17 Routing: DNS vs. Anycast
3:01 Berlin → Frankfurt: the payoff
3:30 Cache HIT
3:57 Cache MISS
4:32 TTL and Cache-Control: max-age
4:54 Revalidation and 304 Not Modified
5:16 Purging and versioned file names
5:30 When a CDN doesn't help
6:30 Recap and what's next

📌 The numbers in this video
• Light in fiber travels about 200,000 km/s, roughly two-thirds of its speed in a vacuum
• Berlin to Virginia is about 6,700 km: ~70 ms per round trip in theory, often ~100 ms in practice
• Berlin to Frankfurt is just over 400 km: often ~10 ms per round trip

💬 What's in your Cache-Control headers? Paste one in the comments.

▶️ Next episode: how load balancers spread traffic across many servers. Subscribe so you catch it.

Data Packet explains system design with animated 3D diagrams. Small packets. Big ideas.

#CDN #CloudArchitecture #WebPerformance
```

(≈ 2,070 characters; limit is 5,000. The first three hashtags show above the title.)

Only the first ~150 characters show before "…more", in search results and under the player. Alternative openings to test:

- A: `A site hosted in Virginia opens almost instantly in Berlin, 6,700 km away. A CDN (Content Delivery Network) makes that possible.` (current: concrete scene plus the keyword in the first sentence)
- B: `One page load from Berlin to a server in Virginia costs hundreds of milliseconds. A CDN (Content Delivery Network) cuts the trip to Frankfurt, about 400 km.` (leads with the pain)
- C: `Follow one request from Berlin to a CDN edge server in Frankfurt and back, then watch what happens on a cache miss.` (leads with the story)

## Tags

Paste as comma-separated (≈ 370 characters; limit 500):

```
cdn, how a cdn works, content delivery network, cdn explained, edge server, edge computing, points of presence, cache hit, cache miss, cache-control, max-age, 304 not modified, etag, cache purge, anycast, bgp, dns, latency, round trip time, web performance, cloudflare, cloudfront, akamai, fastly, system design, system design interview, networking basics, data packet
```

## Upload settings

| Field | Value |
|---|---|
| Category | Science & Technology |
| Audience | No, it's not made for kids |
| Video language | English |
| Caption language | English — upload `how-a-cdn-works.srt` |
| Title & description language | English |
| License | Standard YouTube License |
| Allow embedding | Yes |
| Comments | On; sort by Top |
| Shorts remixing | Allow video and audio |
| Paid promotion | No |
| Altered or synthetic content | No — animated diagrams with an AI narrator voice don't show realistic people, places or events (see note) |
| Playlist | "Cloud Architecture" (create one) |
| Location | none |

**Synthetic content note:** YouTube requires disclosure only for *realistic* altered content, such as a real person saying something they didn't, or realistic footage of events that didn't happen. A generated narrator voice over animation doesn't fall under that. If voice `Gfpl8Yo74Is0W6cPUWWT` is a clone of a real person other than you, choose **Yes**.

## Chapters check

- First chapter at 0:00 ✓
- 15 chapters, in ascending order, each ≥ 10 s ✓ (shortest: 0:20 → 0:48, 28 s)

## End screen (6:52–7:00)

From 6:52 the video shows a centered "NEXT VIDEO" card (upper middle), the comment question below it, and the mascot waving on the right.
- **Element 1:** Video — "Best for viewer" (later: the load balancer video), bottom-left
- **Element 2:** Subscribe button, bottom, left of center
- Start both at 6:52, after the recap checklist. Keep the right third clear for the mascot.

## Cards

| Time | Card |
|---|---|
| 2:17 | Poll: "Does your site use a CDN?" Yes / No / Not sure |
| 5:30 | Video: next load balancer video (once published) |

## Pinned comment

```
Quick quiz 🧠 A user in Tokyo requests hero.jpg for the first time. The Tokyo edge doesn't have it.
What happens next — and who gets a cache HIT afterwards? 👇
```

## Thumbnail

Three A/B variants for YouTube **Test & compare** (Studio → video → Thumbnail → Test & compare): upload all three, YouTube picks the winner by watch time. Re-render with `node src/scripts/record.ts --episode cdn --thumbnail` (scene: `Thumbnail.ts`, style rules: `src/components/ThumbnailKit.ts`); review sheet incl. phone size: `output/renders/how-a-cdn-works-thumbnails-preview.png`.

| File | Hook | Type |
|---|---|---|
| `how-a-cdn-works-thumbnail-a.jpg` (also `-thumbnail.jpg`) | WHY IT'S FAST | payoff |
| `how-a-cdn-works-thumbnail-b.jpg` | ~100 MS → ~10 MS | contrast |
| `how-a-cdn-works-thumbnail-c.jpg` | FAR AWAY. STILL FAST. | curiosity |

Same scene in all three: the long red trip to Virginia vs. the short green hop to Frankfurt, one big number on each arc, the mascot reacting. No title pill (the title already says "How a CDN Works"), bottom-right corner kept clear for the duration badge.

## Social / community post

```
New video: How a CDN works 🌍📦
Why does a site in Virginia load instantly in Berlin? Edge servers, cache hits & misses, Anycast, and when a CDN *doesn't* help — all in 7 animated minutes.
```
