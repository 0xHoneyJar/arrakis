import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Diamond,
  Layers,
  Award,
  Shield,
  Globe,
  Zap,
  Lock,
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  Server,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Features - Arrakis',
  description:
    'Conviction scoring, 9-tier progression, badge gamification, and zero-risk adoption. Everything you need to understand and engage your Web3 community.',
};

const features = [
  {
    id: 'conviction-scoring',
    icon: Diamond,
    badge: 'Premium Feature',
    title: 'Know who your diamond hands are',
    description:
      'Token balance tells you who holds. Conviction scoring tells you who believes. We analyze on-chain behavior to identify your most valuable community members — not just the biggest bags, but the truest believers.',
    details: [
      {
        title: 'Holding Duration',
        description:
          'How long have they held? Someone who bought two years ago and never sold is different from someone who bought yesterday.',
      },
      {
        title: 'Trading Patterns',
        description:
          'Are they accumulating or distributing? Diamond hands add to positions during dips. Flippers take profit at every pump.',
      },
      {
        title: 'On-Chain Activity',
        description:
          'What else are they doing? Active governance participation, protocol usage, and ecosystem engagement all factor in.',
      },
    ],
    useCases: [
      { use: 'Airdrops', benefit: 'Distribute to believers, not farmers' },
      { use: 'Governance', benefit: 'Weight votes by conviction, not just balance' },
      { use: 'Tiered Access', benefit: 'Reserve exclusive channels for diamond hands' },
      { use: 'Recognition', benefit: 'Surface your most committed members' },
    ],
  },
  {
    id: 'tier-progression',
    icon: Layers,
    title: '9 tiers from Outsider to Naib',
    description:
      'Create a progression journey that rewards your most committed members with visible status. Our Dune-themed tier system drives engagement through recognition, not just access.',
    tiers: {
      basic: [
        { tier: 'Gold', icon: '🥇', description: 'Top holders' },
        { tier: 'Silver', icon: '🥈', description: 'Mid-tier holders' },
        { tier: 'Bronze', icon: '🥉', description: 'Entry-level holders' },
      ],
      premium: [
        { tier: 'Naib', rank: '1-7', color: 'Gold', description: 'Council leadership — your inner circle' },
        { tier: 'Fedaykin Elite', rank: '8-15', color: 'Light Gold', description: 'Elite warriors — trusted lieutenants' },
        { tier: 'Fedaykin', rank: '16-30', color: 'Tan', description: 'Proven fighters — active contributors' },
        { tier: 'Fremen', rank: '31-45', color: 'Brown', description: 'Tribe members — committed holders' },
        { tier: 'Wanderer', rank: '46-55', color: 'Dark Brown', description: 'Nomads — regular participants' },
        { tier: 'Initiate', rank: '56-62', color: 'Olive', description: 'Learning the ways — newer members' },
        { tier: 'Aspirant', rank: '63-66', color: 'Dark Olive', description: 'Seeking entry — building conviction' },
        { tier: 'Observer', rank: '67-69', color: 'Charcoal', description: 'Watching — minimal commitment' },
        { tier: 'Outsider', rank: '70+', color: 'Gray', description: 'Just arrived — proving ground' },
      ],
    },
    progression: [
      { step: 'Automatic Ranking', description: 'Members ranked by conviction score (Premium) or balance (Free)' },
      { step: 'Role Assignment', description: 'Discord roles assigned based on tier' },
      { step: 'Dynamic Updates', description: 'Tiers refresh every 6 hours (Premium) or 24 hours (Free)' },
      { step: 'Channel Access', description: 'Gate channels by tier (Naib-only channels, Fremen+ access, etc.)' },
    ],
  },
  {
    id: 'badge-system',
    icon: Award,
    title: 'Gamify engagement with 10+ badge types',
    description:
      'Badges create collector culture in your community. Members earn recognition for tenure, achievements, and contributions — driving engagement beyond simple holder status.',
    badges: [
      { category: 'Tenure Badges', items: [
        { name: 'First Wave', icon: '🌟', requirement: 'Joined in first month' },
        { name: 'Veteran', icon: '🏆', requirement: '6+ months membership' },
        { name: 'Diamond Hands', icon: '💎', requirement: '1+ year holding' },
      ]},
      { category: 'Achievement Badges', items: [
        { name: 'Council', icon: '👑', requirement: 'Reached Naib tier' },
        { name: 'Accumulator', icon: '📈', requirement: 'Increased position 3+ times' },
        { name: 'Voter', icon: '🗳️', requirement: 'Participated in governance' },
      ]},
      { category: 'Activity Badges', items: [
        { name: 'Streak Master', icon: '🔥', requirement: 'Active 30+ consecutive days' },
        { name: 'Engaged', icon: '💬', requirement: 'High Discord activity score' },
      ]},
      { category: 'Community Badges', items: [
        { name: 'Water Sharer', icon: '💧', requirement: 'Awarded by another member (lineage)' },
        { name: 'Contributor', icon: '🤝', requirement: 'Recognized for community contributions' },
      ]},
    ],
    lineage:
      'Members can award certain badges to other members, creating chains of recognition. See who awarded whom and build community bonds.',
  },
  {
    id: 'shadow-mode',
    icon: Shield,
    badge: 'Zero-Risk Adoption',
    title: 'Try alongside your current setup',
    description:
      'Already using Collab.Land or Guild.xyz? Shadow mode lets you run Arrakis in parallel without changing anything. See your conviction data, validate accuracy, switch when ready.',
    modes: [
      { mode: 'Shadow', description: 'Observe only — see conviction data without any changes', risk: 'Zero' },
      { mode: 'Parallel', description: 'Run namespaced roles alongside incumbent', risk: 'Low' },
      { mode: 'Primary', description: 'Arrakis becomes authoritative', risk: 'Medium' },
      { mode: 'Exclusive', description: 'Full takeover, incumbent roles removed', risk: 'Full switch' },
    ],
    migration: [
      'Start in Shadow — Install Arrakis, observe your conviction data',
      'Validate Accuracy — Compare scoring to your intuition about members',
      'Test Parallel — Run both systems, see Arrakis roles alongside existing',
      'Switch When Ready — Promote Arrakis to primary when confident',
    ],
  },
  {
    id: 'multi-chain',
    icon: Globe,
    title: 'One community, many chains',
    description:
      'Your members hold tokens across multiple chains. Arrakis aggregates balances and activity across all major EVM chains through our Score Service.',
    chains: [
      { name: 'Ethereum', status: 'Supported' },
      { name: 'Polygon', status: 'Supported' },
      { name: 'Arbitrum', status: 'Supported' },
      { name: 'Optimism', status: 'Supported' },
      { name: 'Base', status: 'Supported' },
      { name: 'Avalanche', status: 'Supported' },
      { name: 'BNB Chain', status: 'Supported' },
    ],
    crossChain: [
      'Aggregated Balances — Total holdings across chains',
      'Unified Scoring — Single conviction score from all activity',
      'Chain-Specific Roles — Different requirements per chain if needed',
    ],
  },
  {
    id: 'self-service-setup',
    icon: Zap,
    title: 'Set up in 15 minutes. No code required.',
    description:
      'Our wizard guides you through everything. Enter your contract address, configure your tiers, and deploy. No developer needed.',
    steps: [
      { step: 'Welcome', description: 'Name your community and choose your theme' },
      { step: 'Select Chain', description: 'Choose which blockchain(s) your token is on' },
      { step: 'Configure Asset', description: 'Enter your token contract address' },
      { step: 'Set Eligibility Rules', description: 'Define minimum balance, rank thresholds, or conviction requirements' },
      { step: 'Map Roles', description: 'Choose which Discord roles map to which tiers' },
      { step: 'Channel Structure', description: 'Select a template or customize your channel layout' },
      { step: 'Review', description: 'Preview your configuration before deployment' },
      { step: 'Deploy', description: 'One click to create roles, channels, and activate gating' },
    ],
    specs: [
      { aspect: 'Setup time', value: '~15 minutes' },
      { aspect: 'Code required', value: 'None' },
      { aspect: 'Discord permissions', value: 'Manage Roles, Manage Channels' },
      { aspect: 'Session recovery', value: 'Resume interrupted setups with /resume' },
    ],
  },
  {
    id: 'enterprise-security',
    icon: Lock,
    badge: 'Enterprise Feature',
    title: 'Enterprise-grade infrastructure',
    description:
      'Built for protocols with security and compliance requirements. Row-level security, audit trails, and architecture designed for scale.',
    security: [
      {
        title: 'Row-Level Security (RLS)',
        description:
          'Every database query is scoped to your community. Complete tenant isolation at the database level — not application-level filtering.',
      },
      {
        title: 'Audit Trail',
        description:
          'Full logging of all administrative actions. Who changed what, when. Export logs for compliance review.',
      },
      {
        title: 'Two-Tier Architecture',
        description:
          'Our two-tier chain provider ensures token-gating never goes down. If Score Service is unavailable, basic gating continues to work.',
      },
    ],
    infrastructure: [
      { component: 'Database', tech: 'PostgreSQL 15 with RLS' },
      { component: 'Cache', tech: 'Redis 7' },
      { component: 'Secrets', tech: 'HCP Vault' },
      { component: 'Cloud', tech: 'AWS EKS (Kubernetes)' },
      { component: 'Monitoring', tech: 'Datadog' },
    ],
    performance: [
      { metric: 'Basic eligibility check', target: '<100ms' },
      { metric: 'Advanced eligibility check', target: '<500ms' },
      { metric: 'Wizard step response', target: '<3 seconds' },
      { metric: 'Uptime SLA', target: '99.9%' },
    ],
    enterprise: [
      'Custom Themes — Your brand, your tier names, your colors',
      'White-Label — Custom bot name and avatar',
      'API Access — Full API for custom integrations',
      'Dedicated Support — Slack channel with 4-hour SLA',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="section bg-gradient-to-b from-stone-100 to-stone-50">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
              Engagement intelligence for Web3 communities
            </h1>
            <p className="mt-6 text-lg text-stone-600">
              Go beyond token-gating. Identify your most valuable members, reward
              them with tiered progression, and drive engagement through gamification.
            </p>
          </div>
          <div className="mx-auto mt-8 flex flex-wrap justify-center gap-4">
            {features.map((feature) => (
              <a
                key={feature.id}
                href={`#${feature.id}`}
                className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
              >
                {feature.title.split(' ').slice(0, 3).join(' ')}...
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Conviction Scoring */}
      <section id="conviction-scoring" className="section">
        <div className="container-custom">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              {features[0].badge && (
                <span className="mb-4 inline-block rounded-full bg-spice-100 px-3 py-1 text-sm font-medium text-spice-700">
                  {features[0].badge}
                </span>
              )}
              <h2 className="text-3xl font-bold text-stone-900">{features[0].title}</h2>
              <p className="mt-4 text-lg text-stone-600">{features[0].description}</p>
              <div className="mt-8 space-y-6">
                {features[0].details?.map((detail) => (
                  <div key={detail.title}>
                    <h3 className="font-semibold text-stone-900">{detail.title}</h3>
                    <p className="mt-1 text-stone-600">{detail.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-6">
              <h3 className="font-semibold text-stone-900 mb-4">Use Cases</h3>
              <div className="space-y-4">
                {features[0].useCases?.map((uc) => (
                  <div key={uc.use} className="flex gap-4">
                    <div className="flex-shrink-0 font-medium text-spice-600 w-24">{uc.use}</div>
                    <div className="text-stone-600">{uc.benefit}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <Link href="/signup" className="btn-primary w-full text-center">
                  See conviction scoring in action
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tier Progression */}
      <section id="tier-progression" className="section bg-stone-100">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900">{features[1].title}</h2>
            <p className="mt-4 text-lg text-stone-600">{features[1].description}</p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {/* BasicTheme */}
            <div className="rounded-xl border border-stone-200 bg-white p-6">
              <h3 className="font-semibold text-stone-900">BasicTheme (Free)</h3>
              <p className="mt-1 text-sm text-stone-500">Simple 3-tier system for getting started</p>
              <div className="mt-4 space-y-3">
                {features[1].tiers?.basic.map((tier) => (
                  <div key={tier.tier} className="flex items-center gap-3">
                    <span className="text-2xl">{tier.icon}</span>
                    <div>
                      <span className="font-medium text-stone-900">{tier.tier}</span>
                      <span className="ml-2 text-stone-500">— {tier.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SietchTheme */}
            <div className="rounded-xl border-2 border-spice-500 bg-white p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-stone-900">SietchTheme (Premium)</h3>
                <span className="rounded-full bg-spice-100 px-2 py-1 text-xs font-medium text-spice-700">
                  Premium
                </span>
              </div>
              <p className="mt-1 text-sm text-stone-500">Full 9-tier progression inspired by Dune</p>
              <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                {features[1].tiers?.premium.map((tier) => (
                  <div key={tier.tier} className="flex items-center gap-3 text-sm">
                    <span className="w-28 font-medium text-stone-900">{tier.tier}</span>
                    <span className="w-12 text-stone-400">{tier.rank}</span>
                    <span className="text-stone-500">{tier.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-center font-semibold text-stone-900 mb-6">How Progression Works</h3>
            <div className="grid gap-6 md:grid-cols-4">
              {features[1].progression?.map((step, index) => (
                <div key={step.step} className="text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-spice-500 text-white font-bold">
                    {index + 1}
                  </div>
                  <h4 className="mt-3 font-medium text-stone-900">{step.step}</h4>
                  <p className="mt-1 text-sm text-stone-500">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Badge System */}
      <section id="badge-system" className="section">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900">{features[2].title}</h2>
            <p className="mt-4 text-lg text-stone-600">{features[2].description}</p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {features[2].badges?.map((category) => (
              <div key={category.category} className="rounded-xl border border-stone-200 bg-white p-6">
                <h3 className="font-semibold text-stone-900">{category.category}</h3>
                <div className="mt-4 space-y-4">
                  {category.items.map((badge) => (
                    <div key={badge.name} className="flex items-center gap-4">
                      <span className="text-2xl">{badge.icon}</span>
                      <div>
                        <span className="font-medium text-stone-900">{badge.name}</span>
                        <p className="text-sm text-stone-500">{badge.requirement}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 mx-auto max-w-2xl rounded-xl bg-spice-50 p-6 text-center">
            <h3 className="font-semibold text-spice-900">Badge Lineage (Premium)</h3>
            <p className="mt-2 text-spice-700">{features[2].lineage}</p>
          </div>
        </div>
      </section>

      {/* Shadow Mode */}
      <section id="shadow-mode" className="section bg-stone-100">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-4 inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
              Zero-Risk Adoption
            </span>
            <h2 className="text-3xl font-bold text-stone-900">{features[3].title}</h2>
            <p className="mt-4 text-lg text-stone-600">{features[3].description}</p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {features[3].modes?.map((mode) => (
              <div key={mode.mode} className="rounded-xl border border-stone-200 bg-white p-6 text-center">
                <h3 className="font-semibold text-stone-900">{mode.mode}</h3>
                <p className="mt-2 text-sm text-stone-600">{mode.description}</p>
                <span className={`mt-4 inline-block rounded-full px-3 py-1 text-xs font-medium ${
                  mode.risk === 'Zero' ? 'bg-green-100 text-green-700' :
                  mode.risk === 'Low' ? 'bg-yellow-100 text-yellow-700' :
                  mode.risk === 'Medium' ? 'bg-orange-100 text-orange-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {mode.risk} risk
                </span>
              </div>
            ))}
          </div>

          <div className="mt-12 mx-auto max-w-3xl">
            <h3 className="text-center font-semibold text-stone-900 mb-6">Migration Path</h3>
            <div className="space-y-4">
              {features[3].migration?.map((step, index) => (
                <div key={step} className="flex items-start gap-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-spice-500 text-white font-bold">
                    {index + 1}
                  </div>
                  <p className="text-stone-600 pt-1">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Chain */}
      <section id="multi-chain" className="section">
        <div className="container-custom">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold text-stone-900">{features[4].title}</h2>
              <p className="mt-4 text-lg text-stone-600">{features[4].description}</p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                {features[4].chains?.map((chain) => (
                  <div key={chain.name} className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-stone-700">{chain.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-6">
              <h3 className="font-semibold text-stone-900 mb-4">Cross-Chain Features</h3>
              <ul className="space-y-3">
                {features[4].crossChain?.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500 mt-0.5" />
                    <span className="text-stone-600">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Self-Service Setup */}
      <section id="self-service-setup" className="section bg-stone-100">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900">{features[5].title}</h2>
            <p className="mt-4 text-lg text-stone-600">{features[5].description}</p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {features[5].steps?.map((step, index) => (
              <div key={step.step} className="rounded-xl bg-white p-4 text-center">
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-spice-100 text-spice-700 font-bold text-sm">
                  {index + 1}
                </div>
                <h4 className="mt-2 font-medium text-stone-900 text-sm">{step.step}</h4>
                <p className="mt-1 text-xs text-stone-500">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 mx-auto max-w-2xl">
            <div className="grid grid-cols-2 gap-4">
              {features[5].specs?.map((spec) => (
                <div key={spec.aspect} className="flex justify-between rounded-lg bg-white px-4 py-3">
                  <span className="text-stone-500">{spec.aspect}</span>
                  <span className="font-medium text-stone-900">{spec.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Security */}
      <section id="enterprise-security" className="section">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-4 inline-block rounded-full bg-stone-200 px-3 py-1 text-sm font-medium text-stone-700">
              Enterprise Feature
            </span>
            <h2 className="text-3xl font-bold text-stone-900">{features[6].title}</h2>
            <p className="mt-4 text-lg text-stone-600">{features[6].description}</p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {features[6].security?.map((item) => (
              <div key={item.title} className="rounded-xl border border-stone-200 bg-white p-6">
                <h3 className="font-semibold text-stone-900">{item.title}</h3>
                <p className="mt-2 text-stone-600">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-stone-200 bg-white p-6">
              <h3 className="font-semibold text-stone-900 mb-4">Infrastructure</h3>
              <div className="space-y-3">
                {features[6].infrastructure?.map((item) => (
                  <div key={item.component} className="flex justify-between">
                    <span className="text-stone-500">{item.component}</span>
                    <span className="font-medium text-stone-900">{item.tech}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-6">
              <h3 className="font-semibold text-stone-900 mb-4">Performance Targets</h3>
              <div className="space-y-3">
                {features[6].performance?.map((item) => (
                  <div key={item.metric} className="flex justify-between">
                    <span className="text-stone-500">{item.metric}</span>
                    <span className="font-medium text-spice-600">{item.target}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Support */}
      <section className="section bg-stone-100">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900">Discord today. Telegram included.</h2>
            <p className="mt-4 text-lg text-stone-600">
              Primary support for Discord with Telegram integration for communities that span both platforms.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
            <div className="rounded-xl bg-white p-6">
              <div className="flex items-center gap-3 mb-4">
                <MessageCircle className="h-8 w-8 text-indigo-500" />
                <h3 className="font-semibold text-stone-900">Discord</h3>
              </div>
              <ul className="space-y-2 text-stone-600">
                <li>• Role management</li>
                <li>• Channel gating</li>
                <li>• Modal-based wizard</li>
                <li>• Slash commands</li>
                <li>• Event notifications</li>
              </ul>
            </div>
            <div className="rounded-xl bg-white p-6">
              <div className="flex items-center gap-3 mb-4">
                <Server className="h-8 w-8 text-blue-500" />
                <h3 className="font-semibold text-stone-900">Telegram</h3>
              </div>
              <ul className="space-y-2 text-stone-600">
                <li>• Group access control</li>
                <li>• Balance verification</li>
                <li>• Basic tier display</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section bg-spice-500">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-white">Ready to go beyond token-gating?</h2>
            <p className="mt-4 text-lg text-spice-100">
              Start with our free tier. See your community&apos;s conviction data in shadow mode.
              Upgrade when you&apos;re ready.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/signup" className="btn bg-white text-spice-600 hover:bg-stone-100">
                Start Free
              </Link>
              <Link
                href="/demo"
                className="btn border-2 border-white bg-transparent text-white hover:bg-spice-600"
              >
                Schedule Demo
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
