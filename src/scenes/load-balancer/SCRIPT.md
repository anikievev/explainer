# How Load Balancers Work — script & visual beats

Runtime **6:40.0** (64 lines). Timings are locked to the measured voiceover (`npm run voiceover -- --episode load-balancer`). Facts and sources: see [PLAN.md](PLAN.md#2-facts-verified-2026-10-28).

## Visual beats by section

| Time | Section | Visuals |
|---|---|---|
| 0:00.0–0:18.9 | Hook | Episode 1 origin box in Virginia zooms in and opens: one shop server. Sale banner, flood of blue packets, gauge green → yellow → red. Title card 0–5 s, mascot waves. |
| 0:18.9–1:06.3 | 1 · The problem: one server | Server close-up with LoadGauge (CPU/memory/connections). RequestQueue grows in front of it, latency counter climbs. Server flashes red, "shop down" badge. Split: one tall server (scale up, hits a size cap) vs. three small ones (scale out). Question mark over the fork. |
| 1:06.3–2:18.2 | 2 · What a load balancer does | LB node drops in front of the pool. DNS label: shop.example → LB address. Servers dim behind a frosted "hidden" panel, user only sees LB. Pool bracket labelled "target group (AWS)". Algorithm demos, each with per-server counters: round robin 1-2-3-1 (hold 2.5 s), weighted (big server gets 2×), least connections (one slow request keeps server 2 busy, new ones go elsewhere), IP hash (same user colour always to server 3). Chip: "Least connections (AWS ALB: least outstanding requests)". |
| 2:18.2–3:31.1 | 3 · Health checks & failure | HealthPulse rings LB → servers. Lower third: "AWS ALB defaults: every 30 s · 2 fails → unhealthy · 5 passes → healthy". Server 2 turns red after 2 failed pulses; its arc greys out, traffic shifts. A couple of red packets fail before detection. Recovery: 5 green pulses. Fail-open: all three red, LB still sends to all (yellow badge "fail open"). Deploy: server 1 "draining" badge, in-flight packets finish, no new ones. Autoscaling: server 4 rises, passes check, joins. |
| 3:31.1–4:41.2 | 4 · Layer 4 vs. Layer 7 | Envelope packets. L4: sealed envelope labelled IP:port, all packets of one connection (same colour) go to the same server; chip "AWS NLB = Layer 4". L7: envelope opens to show GET /api/cart and Host; routes /api → API pool, /images → image pool, / → shop pool. Chip "AWS ALB = Layer 7 · NGINX / HAProxy = both". Lock icon on both LBs (TLS). Header tag X-Forwarded-For: 203.0.113.7 attached to the packet. |
| 4:41.2–6:02.1 | 5 · Three traps | 1) Mascot gets an AWSALB cookie badge, pinned to server 1 while 2 and 3 idle; server 1 dies, cart icon shatters; fix: purple shared session store, carts survive. 2) LB pulses red "single point of failure"; second LB fades in, virtual IP label hops to it on failure; then two AZ boxes with LB nodes. 3) All app servers draw arcs to one purple database that turns red; small chips "caching · read replicas" (next videos). |
| 6:02.1–6:40.0 | ✓ · Recap | Recap checklist (3 items) on the wide shot, mascot cheers per tick. End card "NEXT VIDEO · Message queues" + comment question, mascot waves. |

## Narration

| Start | End | Line |
|---|---|---|
| 0:00.3 | 0:04.6 | In the last video, the origin was one box in Virginia. |
| 0:04.6 | 0:09.6 | Now picture an online shop in that box. A sale starts. |
| 0:09.6 | 0:13.3 | Traffic spikes, and one server can't keep up. |
| 0:13.3 | 0:17.7 | The fix is called a load balancer. Let's see how it works. |
| 0:19.2 | 0:25.6 | A single server has limits: CPU, memory, and how many connections it can hold. |
| 0:25.6 | 0:30.9 | When requests arrive faster than it can answer, they wait in a queue. |
| 0:30.9 | 0:34.7 | Pages that loaded in a blink now take seconds. |
| 0:34.7 | 0:40.2 | The queue grows, and every user waits longer. |
| 0:40.2 | 0:46.2 | And if that one server crashes, or restarts for an update, the whole shop is down. |
| 0:46.2 | 0:54.1 | You can buy a bigger server. That's scaling up. But there's always a biggest size, and it's still one machine. |
| 0:54.1 | 0:59.9 | Or you can run several smaller servers side by side. That's scaling out. |
| 0:59.9 | 1:05.1 | But now there's a new question: which server should each request go to? |
| 1:06.6 | 1:09.3 | That's the job of a load balancer. |
| 1:09.3 | 1:14.6 | It sits in front of your servers and gives the shop one single address. |
| 1:14.6 | 1:20.0 | That address is in DNS, so users reach it like any other website. |
| 1:20.0 | 1:26.3 | Users only ever talk to the load balancer. They never see the servers behind it. |
| 1:26.3 | 1:31.6 | Those servers form a pool. AWS calls it a target group. |
| 1:31.6 | 1:36.5 | For every request, the load balancer picks one server from the pool. |
| 1:36.5 | 1:45.3 | The simplest way is round robin: one, two, three, then back to one. |
| 1:45.3 | 1:51.3 | Weighted round robin sends more requests to the bigger servers. |
| 1:51.3 | 1:58.4 | Least connections picks the server with the fewest active connections right now. |
| 1:58.4 | 2:02.7 | That helps when some requests are slow and others are quick. |
| 2:02.7 | 2:10.6 | And hashing sends the same client, by its IP address, to the same server every time. |
| 2:10.6 | 2:17.0 | Round robin is the usual default. It works well when servers and requests are alike. |
| 2:18.5 | 2:21.5 | But what if one of those servers breaks? |
| 2:21.5 | 2:28.4 | The load balancer keeps checking. On a regular schedule, it requests a health page from each server. |
| 2:28.4 | 2:39.2 | On AWS, the default is one check every 30 seconds. Two failures in a row, and the server is marked unhealthy. |
| 2:39.2 | 2:45.3 | From then on, it gets no new requests. Users go to the healthy servers instead. |
| 2:45.3 | 2:48.9 | The shop stays open while one server is down. |
| 2:48.9 | 2:53.2 | Until the checks catch it, a few requests can still fail. |
| 2:53.2 | 2:58.6 | When the server recovers and passes five checks in a row, it gets traffic again. |
| 2:58.6 | 3:07.3 | One surprise: if every server fails its checks, an AWS load balancer sends traffic to all of them anyway. |
| 3:07.3 | 3:10.5 | Health checks also make deploys safe. |
| 3:10.5 | 3:20.3 | Before a server is replaced, it's marked as draining. It gets no new requests, but the ones in progress can finish. |
| 3:20.3 | 3:29.9 | And when traffic grows, autoscaling adds servers. Once they pass a health check, the load balancer starts using them. |
| 3:31.4 | 3:36.9 | Load balancers come in two main kinds, named after layers of the network model. |
| 3:36.9 | 3:43.9 | Layer 4 works with connections: IP addresses and ports. It doesn't read what's inside. |
| 3:43.9 | 3:51.5 | Every packet of one connection goes to the same server. AWS's Network Load Balancer works like this. |
| 3:51.5 | 3:56.0 | It's fast, and it works for any protocol, not just the web. |
| 3:56.0 | 4:02.7 | Layer 7 reads the HTTP request itself: the path, the host name, the headers. |
| 4:02.7 | 4:09.8 | One load balancer can serve the shop, the API and the images, each from its own pool of servers. |
| 4:09.8 | 4:17.3 | So it can send /api to one group of servers, and /images to another. |
| 4:17.3 | 4:25.4 | AWS's Application Load Balancer works at Layer 7. NGINX and HAProxy can do both. |
| 4:25.4 | 4:30.9 | Both kinds can handle the encryption. Only Layer 7 reads the request. |
| 4:30.9 | 4:40.0 | The servers now see the load balancer's address, so Layer 7 adds a header, X-Forwarded-For, with the user's real IP. |
| 4:41.5 | 4:44.3 | Load balancing has a few traps. |
| 4:44.3 | 4:51.1 | First, sticky sessions. Some apps keep your shopping cart in one server's memory. |
| 4:51.1 | 4:55.2 | So the load balancer pins you to that server with a cookie. |
| 4:55.2 | 5:00.3 | On AWS, that cookie is called AWSALB. |
| 5:00.3 | 5:06.5 | But pinned users can pile up on one server. And if it dies, their carts are gone. |
| 5:06.5 | 5:11.8 | The usual fix is to keep sessions outside the servers, in a shared store. |
| 5:11.8 | 5:19.4 | Second: the load balancer itself. If it's a single box, it's a new single point of failure. |
| 5:19.4 | 5:28.6 | So you run two. If the active one fails, the standby takes over the same virtual IP address. |
| 5:28.6 | 5:34.2 | Cloud load balancers do this for you, with nodes in several availability zones. |
| 5:34.2 | 5:40.5 | On AWS, an Application Load Balancer always spans at least two zones. |
| 5:40.5 | 5:46.7 | Third: the database. All those app servers often share one database. |
| 5:46.7 | 5:53.5 | A load balancer spreads requests across app servers. It doesn't make that database any faster. |
| 5:53.5 | 6:00.9 | Scaling the database takes other tools, like caching and read replicas. That's a story for another video. |
| 6:02.4 | 6:04.5 | Let's recap. |
| 6:04.5 | 6:10.4 | A load balancer gives many servers one address, and picks a server for each request. |
| 6:10.4 | 6:18.9 | Health checks route around failures. Layer 4 balances connections. Layer 7 reads HTTP. |
| 6:18.9 | 6:24.7 | And watch for sticky sessions, a single load balancer, and the shared database. |
| 6:24.7 | 6:31.1 | Next up: message queues, for when traffic arrives faster than any server can answer. |
| 6:31.1 | 6:35.7 | How many servers sit behind your load balancer? Tell me below. |

Lines with a separate spoken form (`say`): 6 (/api, API, AWS, NGINX, HAProxy, AWSALB, X-Forwarded-For, IP).
