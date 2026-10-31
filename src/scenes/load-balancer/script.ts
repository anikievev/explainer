/**
 * "How Load Balancers Work" — narration script. Times are in seconds and drive
 * the animation beats, the voiceover placement and the exported .srt captions.
 * Timings come from the measured voiceover clips: natural length + 0.7 s, plus
 * `hold` where the animation needs time. Re-lock after editing text with
 * `npm run voiceover -- --episode load-balancer && npm run retime -- --episode load-balancer`.
 */
import type { Cue, Section } from '../../components/Script.ts';
import { findCue, findSection, toSrt as cuesToSrt } from '../../components/Script.ts';

export const DURATION = 400;

export const SECTIONS: Section[] = [
  { start: 0, end: 18.9, index: "", title: "Hook" },
  { start: 18.9, end: 66.2, index: "1", title: "The problem: one server" },
  { start: 66.2, end: 138.1, index: "2", title: "What a load balancer does" },
  { start: 138.1, end: 211, index: "3", title: "Health checks & failure" },
  { start: 211, end: 281.1, index: "4", title: "Layer 4 vs. Layer 7" },
  { start: 281.1, end: 362.1, index: "5", title: "Three traps" },
  { start: 362.1, end: 400, index: "✓", title: "Recap" },
];

export const CUES: Cue[] = [
  // Hook
  { start: 0.3, end: 4.6, text: "In the last video, the origin was one box in Virginia." },
  { start: 4.6, end: 9.6, text: "Now picture an online shop in that box. A sale starts." },
  { start: 9.6, end: 13.3, text: "Traffic spikes, and one server can't keep up." },
  { start: 13.3, end: 17.7, text: "The fix is called a load balancer. Let's see how it works." },

  // The problem: one server
  { start: 19.2, end: 25.5, text: "A single server has limits: CPU, memory, and how many connections it can hold." },
  { start: 25.5, end: 30.8, text: "When requests arrive faster than it can answer, they wait in a queue." },
  { start: 30.8, end: 34.6, text: "Pages that loaded in a blink now take seconds." },
  { start: 34.6, end: 40.1, text: "The queue grows, and every user waits longer.", hold: 1.5 },
  { start: 40.1, end: 46.1, text: "And if that one server crashes, or restarts for an update, the whole shop is down." },
  { start: 46.1, end: 54, text: "You can buy a bigger server. That's scaling up. But there's always a biggest size, and it's still one machine." },
  { start: 54, end: 59.8, text: "Or you can run several smaller servers side by side. That's scaling out." },
  { start: 59.8, end: 65, text: "But now there's a new question: which server should each request go to?" },

  // What a load balancer does
  { start: 66.5, end: 69.2, text: "That's the job of a load balancer." },
  { start: 69.2, end: 74.5, text: "It sits in front of your servers and gives the shop one single address." },
  { start: 74.5, end: 79.9, text: "That address is in DNS, so users reach it like any other website." },
  { start: 79.9, end: 86.2, text: "Users only ever talk to the load balancer. They never see the servers behind it." },
  { start: 86.2, end: 91.5, text: "Those servers form a pool. AWS calls it a target group." },
  { start: 91.5, end: 96.4, text: "For every request, the load balancer picks one server from the pool." },
  { start: 96.4, end: 105.2, text: "The simplest way is round robin: one, two, three, then back to one.", hold: 2.5 },
  { start: 105.2, end: 111.2, text: "Weighted round robin sends more requests to the bigger servers.", hold: 1.5 },
  { start: 111.2, end: 118.3, text: "Least connections picks the server with the fewest active connections right now.", hold: 1.5 },
  { start: 118.3, end: 122.6, text: "That helps when some requests are slow and others are quick." },
  { start: 122.6, end: 130.5, text: "And hashing sends the same client, by its IP address, to the same server every time.", hold: 1.5 },
  { start: 130.5, end: 136.9, text: "Round robin is the usual default. It works well when servers and requests are alike." },

  // Health checks & failure
  { start: 138.4, end: 141.4, text: "But what if one of those servers breaks?" },
  { start: 141.4, end: 148.3, text: "The load balancer keeps checking. On a regular schedule, it requests a health page from each server." },
  { start: 148.3, end: 159.1, text: "On AWS, the default is one check every 30 seconds. Two failures in a row, and the server is marked unhealthy.", hold: 2.0 },
  { start: 159.1, end: 165.2, text: "From then on, it gets no new requests. Users go to the healthy servers instead." },
  { start: 165.2, end: 168.8, text: "The shop stays open while one server is down." },
  { start: 168.8, end: 173.1, text: "Until the checks catch it, a few requests can still fail." },
  { start: 173.1, end: 178.5, text: "When the server recovers and passes five checks in a row, it gets traffic again." },
  { start: 178.5, end: 187.2, text: "One surprise: if every server fails its checks, an AWS load balancer sends traffic to all of them anyway." },
  { start: 187.2, end: 190.4, text: "Health checks also make deploys safe." },
  { start: 190.4, end: 200.2, text: "Before a server is replaced, it's marked as draining. It gets no new requests, but the ones in progress can finish.", hold: 1.5 },
  { start: 200.2, end: 209.8, text: "And when traffic grows, autoscaling adds servers. Once they pass a health check, the load balancer starts using them.", hold: 1.5 },

  // Layer 4 vs. Layer 7
  { start: 211.3, end: 216.8, text: "Load balancers come in two main kinds, named after layers of the network model." },
  { start: 216.8, end: 223.8, text: "Layer 4 works with connections: IP addresses and ports. It doesn't read what's inside." },
  { start: 223.8, end: 231.4, text: "Every packet of one connection goes to the same server. AWS's Network Load Balancer works like this." },
  { start: 231.4, end: 235.9, text: "It's fast, and it works for any protocol, not just the web." },
  { start: 235.9, end: 242.6, text: "Layer 7 reads the HTTP request itself: the path, the host name, the headers." },
  { start: 242.6, end: 249.7, text: "One load balancer can serve the shop, the API and the images, each from its own pool of servers.", say: "One load balancer can serve the shop, the A P I and the images, each from its own pool of servers." },
  { start: 249.7, end: 257.2, text: "So it can send /api to one group of servers, and /images to another.", say: "So it can send slash A P I to one group of servers, and slash images to another.", hold: 1.5 },
  { start: 257.2, end: 265.3, text: "AWS's Application Load Balancer works at Layer 7. NGINX and HAProxy can do both.", say: "A W S's Application Load Balancer works at Layer 7. Engine X and H A Proxy can do both." },
  { start: 265.3, end: 270.8, text: "Both kinds can handle the encryption. Only Layer 7 reads the request." },
  { start: 270.8, end: 279.9, text: "The servers now see the load balancer's address, so Layer 7 adds a header, X-Forwarded-For, with the user's real IP.", say: "The servers now see the load balancer's address, so Layer 7 adds a header, X Forwarded For, with the user's real I P." },

  // Three traps
  { start: 281.4, end: 284.2, text: "Load balancing has a few traps." },
  { start: 284.2, end: 291, text: "First, sticky sessions. Some apps keep your shopping cart in one server's memory." },
  { start: 291, end: 295.1, text: "So the load balancer pins you to that server with a cookie." },
  { start: 295.1, end: 300.2, text: "On AWS, that cookie is called AWSALB.", say: "On A W S, that cookie is called A W S A L B." },
  { start: 300.2, end: 306.4, text: "But pinned users can pile up on one server. And if it dies, their carts are gone." },
  { start: 306.4, end: 311.7, text: "The usual fix is to keep sessions outside the servers, in a shared store." },
  { start: 311.7, end: 319.4, text: "Second: the load balancer itself. If it's a single box, it's a new single point of failure." },
  { start: 319.4, end: 328.6, text: "So you run two. If the active one fails, the standby takes over the same virtual IP address.", hold: 2.0 },
  { start: 328.6, end: 334.2, text: "Cloud load balancers do this for you, with nodes in several availability zones." },
  { start: 334.2, end: 340.5, text: "On AWS, an Application Load Balancer always spans at least two zones.", say: "On A W S, an Application Load Balancer always spans at least two zones." },
  { start: 340.5, end: 346.7, text: "Third: the database. All those app servers often share one database." },
  { start: 346.7, end: 353.5, text: "A load balancer spreads requests across app servers. It doesn't make that database any faster." },
  { start: 353.5, end: 360.9, text: "Scaling the database takes other tools, like caching and read replicas. That's a story for another video." },

  // Recap
  { start: 362.4, end: 364.5, text: "Let's recap." },
  { start: 364.5, end: 370.5, text: "A load balancer gives many servers one address, and picks a server for each request." },
  { start: 370.5, end: 379, text: "Health checks route around failures. Layer 4 balances connections. Layer 7 reads HTTP." },
  { start: 379, end: 384.8, text: "And watch for sticky sessions, a single load balancer, and the shared database." },
  { start: 384.8, end: 391.2, text: "Next up: message queues, for when traffic arrives faster than any server can answer." },
  { start: 391.2, end: 395.8, text: "How many servers sit behind your load balancer? Tell me below." },
];

export const cueAt = (t: number) => findCue(CUES, t);
export const sectionAt = (t: number) => findSection(SECTIONS, t);
export const toSrt = () => cuesToSrt(CUES);
