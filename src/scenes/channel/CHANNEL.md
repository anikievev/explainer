# YouTube channel page — Data Packet

Banner: `output/renders/channel-banner.png` (2560×1440, scene `ChannelBanner.ts`, render with `node src/scripts/record.ts --banner`).

## Positioning

Decided 2026-10-31 from Google Trends (YouTube search) and an outlier scan of ~60 system design channels.

- **Niche:** system design building blocks, animated: how they work and how they fail.
- **Audience:** developers learning system design (junior to mid), including interview prep.
- **Promise:** one building block per video, shown working, failing, then fixed, with real defaults on screen.
- **Out of scope for now:** Kubernetes and tool tutorials, AWS how-tos, broad DevOps, cloud news.

Evidence (relative interest, YouTube search, worldwide, Oct 2021 → Oct 2026):

| Term | 2021 | 2026 | Trend |
|---|---|---|---|
| system design | 13 | 36 | rising (only riser) |
| devops | 15 | 25 | flat |
| kubernetes | 14 | 19 | flat |
| aws | 61 | 64 | falling since 2024 peak (~99) |
| cloud architecture | 1 | 1 | ~no searches |

- Top related queries: system design course, tutorial, interview questions, HLD/LLD, Hello Interview, ByteByteGo, Gaurav Sen. Rising with "load balancer": system design, reverse proxy, load balancer vs api gateway.
- Outliers (≥3× channel median, channels < 200k subs, last 12 months) cluster around: "how X really works / doesn't work like you think" (Ben Dicken, PlanetScale: animated internals), "concepts every developer should know" bundles (Hayk Simonyan), and failure stories ("How to prevent duplicate booking").
- Plain "X explained" searches are owned by big, older videos (Gaurav Sen, IBM, ByteByteGo, Hello Interview). Win on angle and title, not topic name.

## Description

Paste into Settings → Channel → Basic info → Description (≈ 600 characters; limit 1,000). The first line shows in search results and the channel header preview.

```
System design, animated. How the building blocks of big systems work, and how they fail.

Follow Packet, a small data packet, through CDNs, load balancers, message queues, caches, database replicas, shards and more. Each video takes one idea, like "what happens when a server dies", and shows it step by step in 3D, with real defaults from AWS, NGINX and friends.

Made for developers learning system design, including for interviews.

Episodes so far:
• How a CDN Works
• How Load Balancers Work
• How Message Queues Work
• How Caching Works
• How Database Replication Works
• How Database Sharding Works

Next up: consistent hashing. Subscribe to follow along.

Small packets. Big ideas.
```

Optional, only if you'll keep it: add `New episode every [NEED: cadence].` before the subscribe line.

**Each upload:** add the new episode to "Episodes so far" and update "Next up".

## Keywords

Settings → Channel → Basic info → Keywords:

```
system design, system design interview, system design basics, how it works, load balancer, message queue, caching, cdn, distributed systems, animated explainer
```

## Layout

- **Channel trailer (non-subscribers):** How Load Balancers Work (strongest hook: a server dies, users keep shopping).
- **Featured video (returning subscribers):** the latest episode.
- **Sections:** "Episodes" playlist (Cloud Architecture), then "Shorts".
- **Links:** website or newsletter if one exists; otherwise none.

## Playlist: Cloud Architecture

Name kept as "Cloud Architecture" by choice; note the phrase has ~0 YouTube search volume (Trends, Oct 2026), so discovery comes from the description and video tags, not the name.

Order: oldest first (Playlist settings → Ordering → Date published, oldest), so new viewers start at episode 1. Visibility: Public.

Description (≈ 640 characters; limit 5,000). The first two lines show on the playlist page and in search:

```
System design building blocks, animated: how the systems behind websites and apps work, and how they fail. Watch in order: each episode picks up where the last one left off.

1. How a CDN Works: why a site in Virginia loads fast in Berlin
2. How Load Balancers Work: what happens when a server dies mid-sale
3. How Message Queues Work: why your order is confirmed before anything happens
4. How Caching Works: why one expired key can take the database down
5. How Database Replication Works: why a saved change can disappear
6. How Database Sharding Works: why adding one database can move 80% of your data

Each video takes one idea and shows it step by step, with real defaults from AWS and other tools labelled on screen.

For developers learning system design, including for interviews.

Next up: consistent hashing. New episodes are added here as they come out.
```

**Each upload:** add the new episode to the numbered list and update "Next up". Until episode 3 is live, remove line 3 or end it with "(coming soon)".
