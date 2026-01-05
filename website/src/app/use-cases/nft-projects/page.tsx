import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Sparkles,
  Diamond,
  Layers,
  Award,
  Shield,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Arrakis for NFT Projects - Turn Holders into Believers',
  description:
    'Your mint was just the beginning. Create tiered holder experiences that reward your OGs and turn floor-watchers into diamond hands.',
};

const problems = [
  {
    title: 'Post-Mint Silence',
    description:
      "Your Discord was electric during mint week. Now it's crickets. The same people who refreshed OpenSea every hour are gone.",
  },
  {
    title: 'Floor-Watchers Everywhere',
    description:
      "Half your \"holders\" are just waiting to dump. They're not collectors — they're exit liquidity. But they look exactly like your believers.",
  },
  {
    title: 'OGs Feel Invisible',
    description:
      'Someone who minted day one and held through the floor gets the same experience as someone who bought yesterday. No recognition. No reward.',
  },
  {
    title: 'Generic Discord Vibes',
    description:
      "Every NFT server looks the same: holder-verified channel, announcements, general chat. Nothing that makes your community feel special.",
  },
];

const capabilities = [
  {
    icon: Diamond,
    title: 'Identify Collectors vs Flippers',
    description:
      'Conviction scoring goes beyond wallet snapshots. We track holding duration, accumulation patterns, and trading behavior to surface your real collectors.',
    result: 'Stop treating flippers the same as believers.',
  },
  {
    icon: Layers,
    title: '9-Tier Holder Progression',
    description:
      'From Outsider to Naib, your holders earn status as they prove commitment. Your top 7 holders become your council. Tiered channels create aspirational culture.',
    result: 'Holding becomes a journey, not just a transaction.',
  },
  {
    icon: Award,
    title: 'OG Recognition with Badges',
    description:
      'Automatic badges for first-wave minters, long-term holders, multi-NFT collectors, and more. Create collector culture where tenure matters.',
    result: 'Your earliest believers finally get recognition.',
  },
  {
    icon: Sparkles,
    title: 'Stand Out from Generic Servers',
    description:
      'Dune-themed tiers (Fedaykin, Fremen, Wanderer) create unique identity. Custom themes available on Enterprise for full branding control.',
    result: 'A Discord experience as unique as your art.',
  },
];

const useCases = [
  {
    title: 'Post-Mint Engagement Recovery',
    scenario:
      "You minted out 3 months ago. Initial hype faded. Discord engagement dropped 80%. You need to reignite the community without another mint.",
    steps: [
      'Install Arrakis in shadow mode — see holder conviction data',
      'Identify your diamond hands (high conviction) vs floor-watchers (low conviction)',
      'Enable 9-tier progression with SietchTheme',
      'Create tier-gated channels (Fedaykin+ discussions, Naib council)',
      'Roll out badge recognition for early minters',
    ],
    outcome:
      'Holders see a path to status. Floor-watchers either commit or leave. Your believers finally feel recognized.',
  },
  {
    title: 'Holder Airdrops Done Right',
    scenario:
      "You're planning a companion drop or token airdrop. Last time, secondary buyers who held for 12 hours got the same allocation as day-one minters. Not this time.",
    steps: [
      'Run conviction analysis on your holder base',
      'Identify holding duration and accumulation patterns',
      'Export conviction data for your snapshot',
      'Weight allocations by conviction score, not just ownership',
      'Execute distribution that rewards true collectors',
    ],
    outcome:
      'Your OGs get more. Recent buyers get less. The community sees you reward loyalty.',
  },
  {
    title: 'Multi-NFT Holder Recognition',
    scenario:
      "Some holders own 10+ pieces from your collection. Others own 1. Currently they get identical Discord roles. Your whales feel undervalued.",
    steps: [
      'Configure tier thresholds based on quantity + duration',
      'Multi-NFT holders automatically rank higher',
      'Create whale-only channels (Naib council for top 7)',
      'Surface top collectors in member list with gold roles',
      'Enable holder-to-holder badge gifting (lineage)',
    ],
    outcome:
      'Your biggest supporters get visible recognition. Collector culture drives accumulation.',
  },
];

const features = [
  { feature: 'Conviction Scoring', use: 'Identify collectors vs flippers before airdrops' },
  { feature: '9-Tier Progression', use: 'Create aspirational holder journey' },
  { feature: 'Badge System', use: 'Recognize OGs, tenure, achievements' },
  { feature: 'Shadow Mode', use: 'Test alongside Collab.Land risk-free' },
  { feature: 'Multi-Chain', use: 'Support collections across L2s' },
  { feature: 'Self-Service Wizard', use: '15-minute setup, no code required' },
];

const objections = [
  {
    question: "We're a small project",
    answer:
      'Start free with BasicTheme. See the value before spending anything. Premium is less than one secondary sale per month — and it helps you get more sales.',
  },
  {
    question: 'Our community is used to Collab.Land',
    answer:
      "Shadow mode runs alongside your current setup. Your holders won't even notice until you're ready to switch. Zero disruption.",
  },
  {
    question: "We can't afford premium tools",
    answer:
      "Free tier is genuinely useful. Premium at $99/month is the cost of 0.05 ETH — one secondary sale covers months of service. The ROI comes from better holder retention.",
  },
  {
    question: 'Sounds complicated',
    answer:
      '15-minute wizard. No code. Choose your theme, enter your contract address, deploy. We guide you through every step.',
  },
  {
    question: 'How does tier progression drive engagement?',
    answer:
      "Status is powerful. When your holders see a path from Outsider to Naib council, they're incentivized to hold and accumulate. Visible tier roles create FOMO.",
  },
];

export default function NFTProjectsPage() {
  return (
    <>
      {/* Hero */}
      <section className="section bg-gradient-to-b from-stone-100 to-stone-50">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-2 text-sm font-medium text-purple-700">
              <Sparkles className="h-4 w-4" />
              For NFT Projects
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
              Your mint was just the beginning
            </h1>
            <p className="mt-6 text-lg text-stone-600">
              Engagement dies after mint. Arrakis brings it back with 9-tier
              progression that rewards your OGs, identifies your true collectors,
              and turns floor-watchers into diamond hands.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/signup" className="btn-primary">
                Start Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link href="#how-it-works" className="btn-secondary">
                See How It Works
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Problems */}
      <section className="section">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900">Sound familiar?</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {problems.map((problem) => (
              <div
                key={problem.title}
                className="rounded-xl border border-stone-200 bg-white p-6"
              >
                <h3 className="text-lg font-semibold text-stone-900">
                  {problem.title}
                </h3>
                <p className="mt-2 text-stone-600">{problem.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="section bg-stone-100">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900">
              Arrakis turns holders into a community
            </h2>
            <p className="mt-4 text-lg text-stone-600">
              We analyze on-chain behavior to identify your true collectors — not
              just who holds, but who believes. Then we create tiered experiences
              that reward commitment.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {capabilities.map((cap) => (
              <div key={cap.title} className="rounded-xl bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                  <cap.icon className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-stone-900">
                  {cap.title}
                </h3>
                <p className="mt-2 text-stone-600">{cap.description}</p>
                <p className="mt-4 text-sm font-medium text-purple-600">
                  Result: {cap.result}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="how-it-works" className="section">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900">
              How NFT Projects Use Arrakis
            </h2>
          </div>
          <div className="mt-12 space-y-12">
            {useCases.map((uc, index) => (
              <div
                key={uc.title}
                className="rounded-xl border border-stone-200 bg-white p-8"
              >
                <div className="grid gap-8 lg:grid-cols-2">
                  <div>
                    <span className="text-sm font-medium text-purple-600">
                      Use Case {index + 1}
                    </span>
                    <h3 className="mt-2 text-xl font-bold text-stone-900">
                      {uc.title}
                    </h3>
                    <p className="mt-4 text-stone-600">
                      <strong>The Scenario:</strong> {uc.scenario}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-500">
                      With Arrakis:
                    </p>
                    <ol className="mt-4 space-y-2">
                      {uc.steps.map((step, i) => (
                        <li key={step} className="flex items-start gap-3">
                          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                            {i + 1}
                          </span>
                          <span className="text-stone-600">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
                <div className="mt-6 rounded-lg bg-green-50 p-4">
                  <p className="text-green-800">
                    <strong>The Outcome:</strong> {uc.outcome}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section bg-stone-100">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900">
              Features for NFT Projects
            </h2>
          </div>
          <div className="mx-auto mt-12 max-w-3xl">
            <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
              <table className="w-full">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-stone-900">
                      Feature
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-stone-900">
                      How NFT Projects Use It
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {features.map((f) => (
                    <tr key={f.feature}>
                      <td className="px-6 py-4 font-medium text-stone-900">
                        {f.feature}
                      </td>
                      <td className="px-6 py-4 text-stone-600">{f.use}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommended Tiers */}
          <div className="mx-auto mt-12 max-w-4xl grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-stone-200 bg-white p-6">
              <h3 className="text-lg font-bold text-stone-900">Free (Explorer)</h3>
              <p className="mt-1 text-sm text-stone-500">For new projects</p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  BasicTheme (3 tiers)
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Token-gating
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  1 Discord server
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Try before you commit
                </li>
              </ul>
            </div>
            <div className="rounded-xl border-2 border-purple-500 bg-white p-6">
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                Recommended
              </span>
              <h3 className="mt-4 text-lg font-bold text-stone-900">
                Premium ($99/mo)
              </h3>
              <p className="mt-1 text-sm text-stone-500">For established collections</p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Conviction scoring for airdrops
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  9-tier SietchTheme progression
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Badge recognition system
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Analytics dashboard
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-6">
              <h3 className="text-lg font-bold text-stone-900">
                Enterprise ($399/mo)
              </h3>
              <p className="mt-1 text-sm text-stone-500">For blue-chip projects</p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Custom themes matching your brand
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Unlimited servers (multi-collection)
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  API access for custom tooling
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  White-label option
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Objections */}
      <section className="section">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold text-stone-900">
              Common Questions
            </h2>
            <div className="mt-12 divide-y divide-stone-200">
              {objections.map((obj) => (
                <div key={obj.question} className="py-6">
                  <h3 className="font-semibold text-stone-900">
                    &quot;{obj.question}&quot;
                  </h3>
                  <p className="mt-2 text-stone-600">{obj.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section className="section bg-stone-100">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900">
              Set up in 15 minutes
            </h2>
          </div>
          <div className="mx-auto mt-12 max-w-2xl">
            <div className="space-y-4">
              {[
                { step: 'Install Arrakis', desc: 'Add the bot to your Discord server' },
                { step: 'Enter Your Contract', desc: 'NFT collection address, we detect the rest' },
                { step: 'Choose Your Theme', desc: 'BasicTheme (free) or SietchTheme (premium)' },
                { step: 'Configure Tiers', desc: 'Quantity thresholds, duration bonuses' },
                { step: 'Create Channels', desc: 'Tier-gated spaces for different holder levels' },
                { step: 'Go Live', desc: 'Roles assigned automatically based on holdings' },
              ].map((s, i) => (
                <div key={s.step} className="flex items-center gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-purple-500 text-white font-bold">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">{s.step}</p>
                    <p className="text-sm text-stone-500">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section bg-purple-600">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-white">
              Turn your holders into believers
            </h2>
            <p className="mt-4 text-lg text-purple-100">
              Start free. See your holder conviction data. Create the tiered
              experience your OGs deserve.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="btn bg-white text-purple-600 hover:bg-stone-100"
              >
                Start Free
              </Link>
              <Link
                href="/demo"
                className="btn border-2 border-white bg-transparent text-white hover:bg-purple-700"
              >
                Watch Demo
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-purple-200">
              <span>No credit card required</span>
              <span>•</span>
              <span>15-minute setup</span>
              <span>•</span>
              <span>Shadow mode = zero risk</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
