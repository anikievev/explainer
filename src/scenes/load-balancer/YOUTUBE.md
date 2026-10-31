# YouTube metadata — How Load Balancers Work

Channel: **Data Packet** · *Small packets. Big ideas.*
Files: `output/renders/how-load-balancers-work-1080p-voiced.mp4` (6:40) · captions `output/renders/how-load-balancers-work.srt`
Shorts: `output/renders/shorts/load-balancer/` (4 clips + `SHORTS.md`)

## Title

Primary (54 chars):

```
How Load Balancers Work: Why One Server Is Never Enough
```

Alternatives for A/B testing (YouTube "Test & compare"):

```
What Happens When a Server Dies Behind a Load Balancer
Load Balancers Explained Visually: Round Robin, Health Checks, L4 vs L7
How Load Balancers Work (and the 3 Traps Nobody Mentions)
```

## Description

```
A sale starts, traffic spikes, and the one server behind an online shop can't keep up. Pages slow down, then the shop goes dark. A load balancer fixes that by giving many servers one address. This 7-minute animation shows how it picks a server for every request, and what happens when one of them dies.

What you'll see:
• Why one server hits a wall, and the difference between scaling up and scaling out
• How a load balancer sits behind one DNS name and hides the servers behind it
• Four ways to pick a server: round robin, weighted round robin, least connections and hashing
• Health checks: how a broken server gets pulled out of the pool and added back when it recovers
• Why an AWS load balancer sends traffic to every server when all of them fail their checks
• Draining for safe deploys, and autoscaling that adds servers when traffic grows
• Layer 4 vs. Layer 7: connections vs. HTTP requests, /api vs. /images routing, X-Forwarded-For
• Three traps: sticky sessions, the load balancer as a single point of failure, and the shared database

⏱️ Chapters
0:00 One server, one sale, one problem
0:19 What limits a single server
0:46 Scaling up vs. scaling out
1:06 What a load balancer does
1:31 How it picks a server: 4 algorithms
2:18 Health checks: when a server dies
2:58 Recovery, "fail open" and safe deploys
3:20 Autoscaling
3:31 Layer 4 vs. Layer 7
3:55 Layer 7 routing: /api and /images
4:17 ALB vs. NLB, TLS and X-Forwarded-For
4:41 Trap 1: sticky sessions
5:11 Trap 2: the load balancer itself
5:40 Trap 3: the shared database
6:02 Recap and what's next

📌 The AWS defaults in this video (Application Load Balancer)
• Health check every 30 seconds, 5-second timeout
• 2 failed checks in a row → unhealthy; 5 passed checks → healthy again
• Deregistration delay (draining): 300 seconds
• Default algorithm: round robin (also the default in NGINX)
• Stickiness cookie: AWSALB
• Always spans at least two Availability Zones

💬 How many servers sit behind your load balancer? Tell me in the comments.

▶️ Previous episode: How a CDN Works [link]
▶️ Next episode: message queues, for when traffic arrives faster than any server can answer. Subscribe so you catch it.

Data Packet explains system design with animated 3D diagrams. Small packets. Big ideas.

#LoadBalancer #SystemDesign #CloudArchitecture
```

(≈ 2,200 characters; limit is 5,000. The first three hashtags show above the title.)

Only the first ~150 characters show before "…more". Alternative openings to test:

- A: `A sale starts, traffic spikes, and the one server behind an online shop can't keep up.` (current: concrete scene, pain first)
- B: `A load balancer gives many servers one address and picks one for every request. Here's how, and what happens when a server dies.` (keyword first)
- C: `Server 2 just crashed. Users kept shopping. This is how a load balancer pulls that off.` (story hook, matches Short #1)

## Tags

Paste as comma-separated (≈ 440 characters; limit 500):

```
load balancer, how load balancers work, load balancing explained, round robin, least connections, weighted round robin, health check, layer 4 vs layer 7, aws alb, aws nlb, application load balancer, network load balancer, nginx, haproxy, sticky sessions, x-forwarded-for, autoscaling, scaling out, high availability, single point of failure, vrrp, system design, system design interview, data packet
```

## Upload settings

Same as episode 1 (`src/scenes/cdn/YOUTUBE.md`), except:

| Field | Value |
|---|---|
| Caption language | English — upload `how-load-balancers-work.srt` |
| Playlist | "Cloud Architecture" (episode 2) |

## Chapters check

- First chapter at 0:00 ✓
- 15 chapters, ascending, each ≥ 10 s ✓ (shortest: 3:20 → 3:31, 11 s)

## End screen (6:25–6:40)

From 6:25 the scene dims behind a "NEXT VIDEO: Message queues" card, the comment question appears below it, and the mascot waves on the right.
- **Element 1:** Video — "How a CDN Works" (until episode 3 exists), bottom-left
- **Element 2:** Subscribe button, bottom, left of center
- Start both at 6:25. Keep the right third clear for the mascot.

## Cards

| Time | Card |
|---|---|
| 0:05 | Video: "How a CDN Works" (the intro calls back to it) |
| 1:31 | Poll: "What does your load balancer use?" Round robin / Least connections / Hashing / No idea |

## Pinned comment

```
Quick quiz 🧠 Every server behind an AWS Application Load Balancer fails its health check at once.
Where does the next request go? 👇 (Answer at 2:58)
```

## Thumbnail

Three A/B variants for YouTube **Test & compare**: upload all three, YouTube picks the winner by watch time. Re-render with `node src/scripts/record.ts --episode load-balancer --thumbnail` (scene: `Thumbnail.ts`, style rules: `src/components/ThumbnailKit.ts`); review sheet incl. phone size: `output/renders/how-load-balancers-work-thumbnails-preview.png`.

| File | Hook | Badge | Type |
|---|---|---|---|
| `how-load-balancers-work-thumbnail-a.jpg` (also `-thumbnail.jpg`) | ONE SERVER ISN'T ENOUGH | 100% CPU | risk |
| `how-load-balancers-work-thumbnail-b.jpg` | SERVER DOWN. SHOP UP. | DOWN | surprise |
| `how-load-balancers-work-thumbnail-c.jpg` | SURVIVE THE SALE | 100% CPU | payoff |

Same scene in all three: the red overloaded server with its queue in front, a load balancer fanning out to three green servers behind it, the mascot reacting. No title pill, bottom-right corner kept clear for the duration badge.

## Social / community post

```
New video: How load balancers work ⚖️📦
What happens when a server dies mid-sale? Round robin vs. least connections, health checks, Layer 4 vs. Layer 7, and three traps that bite real systems. 7 animated minutes.
```
