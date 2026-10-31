/**
 * Beat times, looked up from the narration by text so the animation follows
 * the script after `npm run retime`. Every value is the start (or end) of the
 * cue that contains the fragment.
 */
import { CUES, SECTIONS } from './script.ts';

function cue(fragment: string) {
  const found = CUES.find((c) => c.text.includes(fragment));
  if (!found) throw new Error(`No cue contains "${fragment}"`);
  return found;
}
const at = (fragment: string) => cue(fragment).start;
const end = (fragment: string) => cue(fragment).end;
const section = (index: string) => SECTIONS.find((s) => s.index === index)!.start;

export const B = {
  // Hook
  intro: at('In the last video'),
  shop: at('Now picture an online shop'),
  spike: at('Traffic spikes'),
  fix: at('The fix is called a load balancer'),

  // 1 · The problem
  s1: section('1'),
  limits: at('A single server has limits'),
  queue: at('When requests arrive faster'),
  blink: at('Pages that loaded in a blink'),
  grows: at('The queue grows'),
  crash: at('And if that one server crashes'),
  scaleUp: at('You can buy a bigger server'),
  scaleOut: at('Or you can run several smaller servers'),
  question: at("But now there's a new question"),

  // 2 · What a load balancer does
  s2: section('2'),
  job: at("That's the job of a load balancer"),
  address: at('It sits in front of your servers'),
  dns: at('That address is in DNS'),
  hidden: at('Users only ever talk to the load balancer'),
  pool: at('Those servers form a pool'),
  picks: at('For every request, the load balancer picks'),
  roundRobin: at('The simplest way is round robin'),
  weighted: at('Weighted round robin'),
  leastConn: at('Least connections picks'),
  leastConnWhy: at('That helps when some requests are slow'),
  hash: at('And hashing sends the same client'),
  defaults: at('Round robin is the usual default'),

  // 3 · Health checks & failure
  s3: section('3'),
  breaks: at('But what if one of those servers breaks'),
  checking: at('The load balancer keeps checking'),
  awsDefaults: at('On AWS, the default is one check every 30 seconds'),
  noNew: at('From then on, it gets no new requests'),
  staysOpen: at('The shop stays open'),
  fewFail: at('Until the checks catch it'),
  recovers: at('When the server recovers'),
  failOpen: at('One surprise'),
  deploys: at('Health checks also make deploys safe'),
  draining: at('Before a server is replaced'),
  autoscale: at('And when traffic grows, autoscaling'),

  // 4 · Layer 4 vs. Layer 7
  s4: section('4'),
  kinds: at('Load balancers come in two main kinds'),
  l4: at('Layer 4 works with connections'),
  l4Same: at('Every packet of one connection'),
  l4Fast: at("It's fast, and it works for any protocol"),
  l7: at('Layer 7 reads the HTTP request'),
  pools: at('One load balancer can serve the shop'),
  paths: at('So it can send /api'),
  vendors: at("AWS's Application Load Balancer works at Layer 7"),
  tls: at('Both kinds can handle the encryption'),
  xff: at('The servers now see'),

  // 5 · Traps
  s5: section('5'),
  traps: at('Load balancing has a few traps'),
  sticky: at('First, sticky sessions'),
  pins: at('So the load balancer pins you'),
  cookie: at('On AWS, that cookie is called'),
  pileUp: at('But pinned users can pile up'),
  store: at('The usual fix is to keep sessions outside'),
  spof: at('Second: the load balancer itself'),
  runTwo: at('So you run two'),
  cloud: at('Cloud load balancers do this for you'),
  zones: at('always spans at least two zones'),
  database: at('Third: the database'),
  dbNotFaster: at("It doesn't make that database any faster"),
  dbTools: at('Scaling the database takes other tools'),
  s5End: end('Scaling the database takes other tools'),

  // Recap
  recap: section('✓'),
  recap1: at('A load balancer gives many servers one address'),
  recap2: at('Health checks route around failures'),
  recap3: at('And watch for sticky sessions'),
  next: at('Next up: message queues'),
  ask: at('How many servers sit behind'),
};
