# Episode 2 plan: How Load Balancers Work

Format: concept explainer · target **6:15–7:00** · 1080p + 4K · English narration with the same voice.

**Promise from episode 1:** the end card says "How load balancers work" and the narration says "Next up: how load balancers spread traffic." The title and the first minute have to deliver on that.

**Bridge from episode 1:** in the CDN video the origin was one box in Virginia. A CDN only answers cacheable requests. Everything personal (carts, logins, APIs) still goes to the origin. This episode opens that box.

**Running example:** an online shop, `shop.example`. A sale starts and traffic jumps. Same characters as before: the Data Packet mascot is a request, and the user is in Berlin.

---

## 1. Structure and visual beats

| Time | Section | What the viewer learns | Main visual |
|---|---|---|---|
| 0:00–0:20 | Hook | "One server. Then a sale starts." | The episode 1 origin box zooms in. A flood of blue packets turns its load gauge from green to yellow to red, and requests queue up. Title card. |
| 0:20–1:20 | 1 · The problem | One server has limits: CPU, memory and connections. When it's busy, requests wait. When it restarts or crashes, the site is down. Bigger server (scale up) vs. more servers (scale out). | Request queue growing in front of one server, with a latency number climbing. Split screen: one big server vs. three small ones. |
| 1:20–2:40 | 2 · What a load balancer is | One address in front of many servers. Clients only see the load balancer. Server pool / target group. Algorithms: round robin, weighted, least connections, hashing. | The load balancer appears as a distinct node. Packets fan out to 3 servers. Each algorithm runs for about 10 s with a counter on each server, so the difference is visible. |
| 2:40–4:00 | 3 · Health checks and failure | The LB probes `/health` every few seconds. After N failures it stops sending traffic to that server. Recovery. Connection draining during deploys. Autoscaling adds servers and the LB starts using them. | Pulse rings from the LB to each server. Server 2 goes red, its arc greys out and traffic shifts to the others. Server 4 drops in (autoscaling). A "draining" badge appears during a deploy. |
| 4:00–5:10 | 4 · Layer 4 vs. Layer 7 | L4 sees IP addresses and ports only, so it is fast and protocol-agnostic. L7 reads HTTP: path, host and headers. It can route `/api` and `/images` to different pools, terminate TLS, and add `X-Forwarded-For`. | The packet "envelope": at L4 it stays sealed (IP:port on the label). At L7 the envelope opens to show `GET /api/cart`, and it routes to the API pool. |
| 5:10–6:20 | 5 · Pitfalls | Sticky sessions cause uneven load and lose sessions when a server dies, so store sessions outside the servers instead. The LB itself as a single point of failure: use a redundant pair with a floating IP, or a managed cloud LB. A shared database bottleneck: an LB spreads load across app servers, not across one database. | Mascot "stuck" to server 1 while the others are idle. A second LB takes over the virtual IP. All servers point at one purple database that turns red. |
| 6:20–7:00 | ✓ Recap + next | 3 checks, as in the CDN recap. Tease: "What if traffic arrives faster than any number of servers can handle? Next: message queues." | Recap checklist on the overview shot, then the next-video card with the mascot waving. |

Pacing rule from episode 1: write the narration at about **2.2 words/s**, not 2.5. The ElevenLabs voice reads slower, and episode 1 needed 13 lines cut after the voiceover.

## 2. Facts (verified 2026-10-28)

Each claim below was checked against the source listed. Narration may only use claims from this table.

| Claim usable in narration / on screen | Source |
|---|---|
| A load balancer sends traffic only to healthy targets, stops when one turns unhealthy, and resumes when it recovers | [AWS: How ELB works](https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html) |
| ALB = **Layer 7**, NLB = **Layer 4** (AWS's own comparison table) | [AWS ELB features](https://aws.amazon.com/elasticloadbalancing/features/) |
| ALB picks a target per request: default **round robin**, also **least outstanding requests** and **weighted random** | [AWS ALB target group attributes](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-target-group-attributes.html) |
| NLB uses a **flow hash** (protocol, source/destination IP and port, TCP sequence number) and keeps each TCP connection on one target for its whole life | [AWS: How ELB works](https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html) |
| NGINX methods: round-robin (default), least-connected, ip-hash, plus per-server weights | [NGINX load balancing](https://nginx.org/en/docs/http/load_balancing.html) |
| NGINX also has passive health checks: a failed response marks the server failed for a while (`max_fails` default 1) | same |
| ALB health check defaults: every **30 s**, 5 s timeout, unhealthy after **2** consecutive failures, healthy again after **5** successes; default path `/` | [AWS ALB health checks](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html) |
| If every target is unhealthy, ALB **fails open** and sends traffic to all of them | same |
| Deregistration delay (connection draining): default **300 s**; the target state is `draining`, no new requests, in-flight ones can finish | [AWS ALB target group attributes](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-target-group-attributes.html) |
| Sticky sessions bind a user to one target using a cookie (`AWSALB` on ALB); if that target becomes unhealthy, the LB picks a new one | same |
| ALB adds `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Port` | [AWS: How ELB works](https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html) |
| **Both** ALB and NLB can terminate TLS ("SSL offloading") | [AWS ELB features](https://aws.amazon.com/elasticloadbalancing/features/) |
| A managed ELB is made of **load balancer nodes in each enabled Availability Zone**; ALB requires at least two AZs | [AWS: How ELB works](https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html) |
| VRRP elects one "Master" that answers for a virtual IP; if it fails, another router takes over | [RFC 5798](https://www.rfc-editor.org/rfc/rfc5798) |

**Corrections to the first draft of this plan:**
- TLS termination is **not** an L7-only feature (NLB has TLS listeners too). Narration: "both can handle encryption; only Layer 7 reads the HTTP request."
- AWS calls its "least connections" option *least outstanding requests*. On screen: "Least connections (AWS ALB: least outstanding requests)".
- Health check numbers on screen: use the AWS defaults above and label them "AWS ALB defaults", not as universal values.

**Good extra beats found while checking:**
- *Fail open* (all targets unhealthy → ALB tries all of them) is a short surprising fact for the health-check section or a Short.
- The NLB flow hash ("same connection, same server") makes a clean visual for Layer 4.

Avoid unsupported numbers like "handles 1M requests/s". Use relative visuals (gauges, counters) instead.

## 3. Reuse vs. build

**Reuse as is:**
- CameraRig, Timeline, Hud (labels, lower thirds, chips, badges, recap, end card), Label3D
- PacketPool and ArcPath for request flow
- NodeMesh servers and the purple database
- The DiagramStage floor look
- Mascot and MascotLayer presenter
- The pipeline: `record.ts`, `voiceover.ts`, `shorts.ts`, the thumbnail and YouTube metadata

**New components** (in `src/components/`, reusable for Kubernetes and microservices later):

| Component | Purpose |
|---|---|
| `createLoadBalancer()` in NodeMesh | Distinct LB node: a flat wide unit with a fan-out light strip |
| `LoadGauge` | Bar or ring above a server: green → yellow → red, driven by a number |
| `RequestQueue` | Line of waiting packets in front of a server, length driven by t |
| `HealthPulse` | Ring travelling LB → server and back, green OK / red fail |
| `Envelope` | Packet that can "open" to show an HTTP request line, for L4 vs. L7 |
| `Distributor` | Deterministic assignment of request i → server for each algorithm (round robin, weighted, least-conn, hash), so the counters on screen are correct and reproducible |

**Mascot role:** the mascot is a single request with a visible journey:
- Gets routed by the LB.
- Gets "stuck" to one server in the sticky-sessions beat.
- Cheers when failover keeps the shop up.
- Presents from the corner in sections 3 to 5, as in episode 1.

## 4. Code work before building the scene

Episode 1 hard-codes the CDN in the pipeline. Make it multi-video first (about half a day):

1. **Scene registry:** `src/scenes/index.ts` maps a slug to its scene class, script and shorts. `main.ts` reads `?video=load-balancer`. `record.ts`, `voiceover.ts` and `shorts.ts` take `--video <slug>` (default: the latest episode). Output names come from the slug.
2. **Move shared script types** (`Cue`, `Section`, `toSrt`, `cueAt`) into `src/components/Script.ts`. Each episode keeps only its `CUES`/`SECTIONS`.
3. **Move the shared "kicker"** ("HOW A CDN WORKS") in `shorts.ts` into the per-episode config.
4. **Keep the CDN episode re-renderable unchanged.** Run a still-diff on 5 timestamps before and after the refactor.

## 5. Production steps

| # | Step | Output |
|---|---|---|
| 1 | ~~Refactor to multi-video~~ done (section 4) | Episode 1 renders pixel-identical |
| 2 | ~~Verify facts~~ done (section 2) | Sources in this plan; copy to `SCRIPT.md` |
| 3 | Write the full narration with timed cues at 2.2 words/s | `script.ts`, `SCRIPT.md` |
| 4 | Voiceover dry run before building visuals; fix overruns in text | Clip lengths fit their slots |
| 5 | Build components, then the scene section by section | Stills at each beat for review |
| 6 | Full render, voiceover mux, captions | `how-load-balancers-work-1080p-voiced.mp4`, `.srt` |
| 7 | Thumbnail, Shorts, YouTube metadata | Same tools as episode 1 |

Step 4 is new: generating the voiceover **before** animating locks the real timing, so the visual beats are built to the actual audio instead of being re-fitted afterwards.

## 6. Shorts planned up front

Write these sections so each can stand alone (a hook line at the start, a payoff at the end):

| Short | Source | Hook |
|---|---|---|
| What happens when a server dies | Section 3 | "Server 2 just crashed. Your users didn't notice." |
| Round robin vs. least connections | Section 2 algorithms | Counters racing on screen |
| Layer 4 vs. Layer 7 in 60 seconds | Section 4 | Envelope sealed vs. opened |
| Why sticky sessions hurt | Section 5 | Mascot stuck to one busy server |

## 7. Packaging

- **Title:** `How Load Balancers Work: Why One Server Is Never Enough`
  - Alternative: `What Happens When a Server Dies Behind a Load Balancer`
  - Alternative: `Load Balancers Explained Visually: Round Robin, Health Checks, L4 vs L7`
- **Thumbnail:** left, one red overheating server with a long queue. Right, a load balancer fanning out to three green servers. Mascot in the middle. Text: `ONE SERVER ISN'T ENOUGH`.
- **Hashtags:** `#LoadBalancer #SystemDesign #CloudArchitecture`
- **End-screen tease:** message queues (episode 3).

## Decisions

- **Length:** around 7:00, a little shorter is fine (target 6:15–7:00). Cut rather than pad.
- **Vendor names:** show them on screen where they make a point concrete (e.g. "AWS ALB = Layer 7, NLB = Layer 4", "NGINX / HAProxy" as examples of software LBs). Keep the narration vendor-neutral otherwise.
