/**
 * Vertical Shorts cut from the full "How Load Balancers Work" render. Times
 * are looked up from cue text (like beats.ts), so they follow `npm run retime`;
 * each Short starts and ends on a cue boundary and stays under 60 s.
 */
import type { Short } from '../../components/Script.ts';
import { CUES } from './script.ts';

function cue(fragment: string) {
  const found = CUES.find((c) => c.text.includes(fragment));
  if (!found) throw new Error(`No cue contains "${fragment}"`);
  return found;
}
/** Start a little before the cue, end a little after it, so no word is clipped. */
const from = (fragment: string) => cue(fragment).start - 0.3;
const to = (fragment: string) => cue(fragment).end + 0.8;
const at = (fragment: string) => cue(fragment).start;
/** One or more whole cues, for a cold open. */
const clip = (first: string, last = first) => ({ start: from(first), end: cue(last).end + 0.2 });

const GREEN = '#34d399';
const YELLOW = '#fbbf24';
const RED = '#f87171';
const BLUE = '#38bdf8';

export const SHORTS: Short[] = [
  {
    slug: 'what-happens-when-a-server-dies',
    // Open on the payoff; "But what if one of those servers breaks?" needs the pool from earlier.
    open: clip('The shop stays open while one server is down'),
    start: from('The load balancer keeps checking'),
    end: to('One surprise'),
    hook: 'A server just died. Users kept shopping.',
    // "✗ 2 → UNHEALTHY" on server 2, traffic going around it.
    cover: at('From then on, it gets no new requests') + 0.8,
    beats: [
      { at: at('The load balancer keeps checking'), text: 'Server 2 breaks · health checks', color: RED },
      { at: at('From then on, it gets no new requests'), text: 'No traffic to it', color: YELLOW },
      { at: at('When the server recovers'), text: 'Back in the pool', color: GREEN },
      { at: at('One surprise'), text: 'Surprise: fail open', color: RED },
    ],
    title: 'What happens when a server dies behind a load balancer',
    description:
      'Health checks catch the broken server, and the load balancer stops sending it requests. On AWS that takes two failed checks, 30 seconds apart by default. And if every server fails its checks, an AWS load balancer sends traffic to all of them anyway.',
    hashtags: ['#loadbalancer', '#systemdesign', '#aws'],
  },
  {
    slug: 'four-ways-to-pick-a-server',
    start: from('For every request, the load balancer picks'),
    end: to('Round robin is the usual default'),
    hook: '4 ways a load balancer picks a server',
    // Least connections: the "N active" counters next to each server.
    cover: at('Least connections picks') + 4,
    beats: [
      { at: at('The simplest way is round robin'), text: '1/4 · Round robin', color: BLUE },
      { at: at('Weighted round robin'), text: '2/4 · Weighted', color: BLUE },
      { at: at('Least connections picks'), text: '3/4 · Least connections', color: BLUE },
      { at: at('And hashing sends the same client'), text: '4/4 · Hashing', color: BLUE },
    ],
    title: 'Round robin vs. least connections: how a load balancer picks a server',
    description:
      'Round robin takes turns. Weighted round robin gives bigger servers more. Least connections picks the least busy one. Hashing sends the same client IP to the same server. Round robin is the default in NGINX and AWS ALB.',
    hashtags: ['#loadbalancer', '#systemdesign', '#nginx'],
  },
  {
    slug: 'layer-4-vs-layer-7',
    start: from('Load balancers come in two main kinds'),
    end: to("AWS's Application Load Balancer works at Layer 7"),
    hook: 'Layer 4 vs. Layer 7',
    // Layer 7 routing: /, /api/*, /images/* on the three lanes.
    cover: at('So it can send /api') + 2,
    beats: [
      { at: at('Layer 4 works with connections'), text: 'Layer 4 · connections', color: BLUE },
      { at: at('Layer 7 reads the HTTP request'), text: 'Layer 7 · HTTP requests', color: BLUE },
      { at: at("AWS's Application Load Balancer works at Layer 7"), text: 'ALB = L7 · NLB = L4', color: GREEN },
    ],
    title: 'Layer 4 vs. Layer 7 load balancers in under a minute',
    description:
      'Layer 4 sees IP addresses and ports and keeps each connection on one server. Layer 7 reads the HTTP request, so it can send /api and /images to different servers. AWS NLB works at Layer 4, ALB at Layer 7, and NGINX and HAProxy can do both.',
    hashtags: ['#loadbalancer', '#networking', '#aws'],
  },
  {
    slug: 'why-sticky-sessions-hurt',
    linkedin: `Sticky sessions look like an easy fix until the server dies and takes every pinned user's cart with it.

Some apps keep the shopping cart in one server's memory, so the load balancer pins each user to that server with a cookie (on AWS, AWSALB). Pinned users can pile up on one server, and when it dies, their carts are gone.

The usual fix is to keep sessions outside the servers, in a shared store. Then any server can take any request, and losing one server loses no carts.

Where do your sessions live?`,
    // Start on "a few traps" so "First, sticky sessions" isn't the first word heard.
    start: from('Load balancing has a few traps'),
    end: to('The usual fix is to keep sessions outside'),
    hook: 'Why sticky sessions hurt',
    // "CARTS LOST" on the pinned server.
    cover: at('But pinned users can pile up') + 3.6,
    beats: [
      { at: at('First, sticky sessions'), text: 'Cart in one server', color: YELLOW },
      { at: at('But pinned users can pile up'), text: 'Server dies → carts gone', color: RED },
      { at: at('The usual fix is to keep sessions outside'), text: 'Fix: shared session store', color: GREEN },
    ],
    title: 'Why sticky sessions hurt (and the usual fix)',
    description:
      'A cookie pins each user to one server (on AWS, the AWSALB cookie). Pinned users pile up, and when that server dies, their carts go with it. The usual fix: keep sessions in a shared store outside the servers.',
    hashtags: ['#loadbalancer', '#systemdesign', '#webdev'],
  },
];
