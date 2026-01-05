import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, X, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing - Arrakis',
  description:
    'Start free, upgrade when you\'re ready. Conviction scoring and 9-tier progression for Web3 communities. Free tier forever, Premium at $99/mo.',
};

const tiers = [
  {
    name: 'Free',
    subtitle: 'Explorer',
    price: '$0',
    period: '/month forever',
    description:
      'Everything you need to get started with token-gated community management.',
    features: [
      { name: 'Token-gating (ERC20 & NFT)', included: true },
      { name: 'Multi-chain support', included: true },
      { name: 'BasicTheme (3 tiers: Gold, Silver, Bronze)', included: true },
      { name: '5 badge types', included: true },
      { name: '1 Discord server', included: true },
      { name: 'Shadow mode (try alongside current setup)', included: true },
      { name: 'Self-service wizard', included: true },
      { name: 'Community support', included: true },
    ],
    limits: ['Balance refresh: Every 24 hours', 'No conviction scoring', 'No analytics'],
    cta: 'Start Free',
    ctaHref: '/signup',
    note: 'No credit card required',
  },
  {
    name: 'Premium',
    subtitle: 'Sietch',
    price: '$99',
    period: '/month',
    annualPrice: '$79/month billed annually',
    description:
      'Engagement intelligence for communities that want to identify and reward their most valuable members.',
    badge: 'Most Popular',
    features: [
      { name: 'Everything in Free, plus:', included: true, bold: true },
      { name: 'Conviction scoring — identify diamond hands', included: true },
      { name: 'SietchTheme (9 tiers: Naib → Outsider)', included: true },
      { name: '10+ badge types with lineage tracking', included: true },
      { name: 'Analytics dashboard — community insights', included: true },
      { name: 'Up to 3 Discord servers', included: true },
      { name: '1 Telegram group', included: true },
      { name: 'Balance refresh: Every 6 hours', included: true },
      { name: 'Priority email support', included: true },
    ],
    limits: [
      '3 Discord servers (add more at $29/mo each)',
      '1 Telegram group (add more at $19/mo each)',
    ],
    cta: 'Start Premium',
    ctaHref: '/signup?plan=premium',
    specialOffer: 'Founding 50: Get 50% off for life ($49/mo forever)',
    featured: true,
  },
  {
    name: 'Enterprise',
    subtitle: 'Naib Council',
    price: '$399',
    period: '/month',
    annualPrice: '$319/month billed annually',
    description:
      'Enterprise-grade infrastructure for protocols and multi-community operators with security and compliance requirements.',
    features: [
      { name: 'Everything in Premium, plus:', included: true, bold: true },
      { name: 'Custom themes — your brand, your tiers', included: true },
      { name: 'Unlimited Discord servers', included: true },
      { name: 'Unlimited Telegram groups', included: true },
      { name: 'Full API access — build integrations', included: true },
      { name: 'Audit trail — compliance-ready logging', included: true },
      { name: 'White-label option — custom bot name/avatar', included: true },
      { name: 'Balance refresh: Every 1 hour', included: true },
      { name: 'Dedicated Slack support', included: true },
      { name: 'SLA with 4-hour response time', included: true },
    ],
    cta: 'Contact Sales',
    ctaHref: '/contact',
    note: 'Custom pricing available for 10+ communities',
  },
];

const comparisonFeatures = [
  { category: 'Token-Gating', features: [
    { name: 'ERC20 token gating', free: true, premium: true, enterprise: true },
    { name: 'NFT ownership gating', free: true, premium: true, enterprise: true },
    { name: 'Multi-chain support', free: true, premium: true, enterprise: true },
    { name: 'Shadow/coexistence mode', free: true, premium: true, enterprise: true },
  ]},
  { category: 'Progression System', features: [
    { name: 'Tier system', free: '3 tiers', premium: '9 tiers', enterprise: 'Custom' },
    { name: 'Theme', free: 'BasicTheme', premium: 'SietchTheme', enterprise: 'Custom' },
    { name: 'Badges', free: '5', premium: '10+', enterprise: 'Unlimited' },
    { name: 'Badge lineage', free: false, premium: true, enterprise: true },
  ]},
  { category: 'Intelligence', features: [
    { name: 'Conviction scoring', free: false, premium: true, enterprise: true },
    { name: 'Analytics dashboard', free: false, premium: true, enterprise: true },
    { name: 'Holder insights', free: false, premium: true, enterprise: true },
    { name: 'Airdrop planning data', free: false, premium: true, enterprise: true },
  ]},
  { category: 'Platform Support', features: [
    { name: 'Discord servers', free: '1', premium: '3', enterprise: 'Unlimited' },
    { name: 'Telegram groups', free: '—', premium: '1', enterprise: 'Unlimited' },
  ]},
  { category: 'Operations', features: [
    { name: 'Balance refresh', free: '24h', premium: '6h', enterprise: '1h' },
    { name: 'Self-service wizard', free: true, premium: true, enterprise: true },
    { name: 'API access', free: '—', premium: 'Read-only', enterprise: 'Full' },
  ]},
  { category: 'Security & Compliance', features: [
    { name: 'Row-level security', free: true, premium: true, enterprise: true },
    { name: 'Audit trail', free: false, premium: false, enterprise: true },
    { name: 'White-label', free: false, premium: false, enterprise: true },
    { name: 'Custom SLA', free: false, premium: false, enterprise: true },
  ]},
  { category: 'Support', features: [
    { name: 'Community Discord', free: true, premium: true, enterprise: true },
    { name: 'Email support', free: '—', premium: '24h', enterprise: '4h SLA' },
    { name: 'Dedicated Slack', free: false, premium: false, enterprise: true },
  ]},
];

const faqs = [
  {
    question: 'Can I try Premium features before paying?',
    answer:
      'Yes! Shadow mode is available on the Free tier. You can see conviction data for your community without changing anything. When you\'re ready for tiered progression and full analytics, upgrade to Premium.',
  },
  {
    question: 'What happens if I exceed my server limit?',
    answer:
      'On Premium, you can add additional Discord servers at $29/month each, or upgrade to Enterprise for unlimited servers.',
  },
  {
    question: 'Can I switch plans anytime?',
    answer:
      'Yes. Upgrade anytime and your new features activate immediately. Downgrade takes effect at the next billing cycle.',
  },
  {
    question: 'What\'s the refund policy?',
    answer:
      'Annual plans: Pro-rated refund within 30 days. Monthly plans: No refunds, but you can cancel anytime.',
  },
  {
    question: 'Do you offer discounts for DAOs?',
    answer:
      'Our standard pricing is designed for DAO treasuries. Founding 50 members get 50% off Premium for life. Annual billing saves 20%.',
  },
  {
    question: 'What chains do you support?',
    answer:
      'All major EVM chains through our Score Service, including Ethereum, Polygon, Arbitrum, Optimism, Base, and more.',
  },
  {
    question: 'Is my community data secure?',
    answer:
      'Yes. We use PostgreSQL with row-level security (RLS) for complete tenant isolation. Enterprise tier includes full audit trails for compliance.',
  },
  {
    question: 'Can I use Arrakis alongside Collab.Land?',
    answer:
      'Absolutely. Shadow mode is designed for this. Run Arrakis in parallel, see your conviction data, and switch when you\'re confident. Zero risk.',
  },
  {
    question: 'What\'s the Founding 50 offer?',
    answer:
      'The first 50 customers who sign up for Premium get 50% off for life. That\'s $49/month instead of $99/month, locked in forever. Must commit to annual billing.',
  },
];

const addOns = [
  { name: 'Additional Discord Server', price: '$29/month', note: 'Available on Premium tier' },
  { name: 'Additional Telegram Group', price: '$19/month', note: 'Available on Premium tier' },
  { name: 'Custom Badge Design', price: '$199 one-time', note: 'Professional badge artwork' },
  { name: 'Theme Customization', price: '$499 one-time', note: 'Custom theme design (Premium tier)' },
];

export default function PricingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="section bg-gradient-to-b from-stone-100 to-stone-50">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
              Simple pricing for communities of all sizes
            </h1>
            <p className="mt-6 text-lg text-stone-600">
              Start free with BasicTheme. Upgrade to Premium for conviction
              scoring and 9-tier progression. Enterprise for custom needs.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="section -mt-8 pt-0">
        <div className="container-custom">
          <div className="grid gap-8 lg:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl border p-8 ${
                  tier.featured
                    ? 'border-spice-500 bg-white shadow-xl ring-2 ring-spice-500'
                    : 'border-stone-200 bg-white'
                }`}
              >
                {tier.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-spice-500 px-4 py-1 text-sm font-semibold text-white">
                    {tier.badge}
                  </span>
                )}
                <div className="text-center">
                  <h2 className="text-xl font-bold text-stone-900">{tier.name}</h2>
                  <p className="text-sm text-stone-500">{tier.subtitle}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-stone-900">{tier.price}</span>
                    <span className="text-stone-500">{tier.period}</span>
                  </div>
                  {tier.annualPrice && (
                    <p className="mt-1 text-sm text-green-600">or {tier.annualPrice}</p>
                  )}
                  <p className="mt-4 text-sm text-stone-600">{tier.description}</p>
                </div>

                <ul className="mt-8 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature.name} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                      <span className={`text-sm text-stone-600 ${'bold' in feature && feature.bold ? 'font-semibold' : ''}`}>
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>

                {tier.limits && (
                  <div className="mt-6 border-t border-stone-200 pt-4">
                    <p className="text-xs font-medium text-stone-400 uppercase">Limits</p>
                    <ul className="mt-2 space-y-1">
                      {tier.limits.map((limit) => (
                        <li key={limit} className="text-xs text-stone-500">
                          {limit}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-8">
                  <Link
                    href={tier.ctaHref}
                    className={`block w-full rounded-lg py-3 text-center text-sm font-semibold ${
                      tier.featured
                        ? 'bg-spice-500 text-white hover:bg-spice-600'
                        : 'bg-stone-100 text-stone-900 hover:bg-stone-200'
                    }`}
                  >
                    {tier.cta}
                  </Link>
                  {tier.note && (
                    <p className="mt-2 text-center text-xs text-stone-500">{tier.note}</p>
                  )}
                  {tier.specialOffer && (
                    <div className="mt-4 rounded-lg bg-spice-50 p-3 text-center">
                      <p className="text-sm font-medium text-spice-700">
                        🎁 {tier.specialOffer}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="section bg-stone-100">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900">Compare plans in detail</h2>
          </div>
          <div className="mx-auto mt-12 max-w-5xl overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-stone-300">
                  <th className="pb-4 pr-4 text-left text-sm font-semibold text-stone-900">
                    Feature
                  </th>
                  <th className="pb-4 px-4 text-center text-sm font-semibold text-stone-900 w-24">
                    Free
                  </th>
                  <th className="pb-4 px-4 text-center text-sm font-semibold text-spice-600 w-24">
                    Premium
                  </th>
                  <th className="pb-4 pl-4 text-center text-sm font-semibold text-stone-900 w-24">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((category) => (
                  <>
                    <tr key={category.category}>
                      <td
                        colSpan={4}
                        className="pt-6 pb-2 text-sm font-bold text-stone-900 bg-stone-50"
                      >
                        {category.category}
                      </td>
                    </tr>
                    {category.features.map((feature) => (
                      <tr key={feature.name} className="border-b border-stone-200">
                        <td className="py-3 pr-4 text-sm text-stone-600">{feature.name}</td>
                        <td className="py-3 px-4 text-center">
                          <FeatureValue value={feature.free} />
                        </td>
                        <td className="py-3 px-4 text-center bg-spice-50/50">
                          <FeatureValue value={feature.premium} />
                        </td>
                        <td className="py-3 pl-4 text-center">
                          <FeatureValue value={feature.enterprise} />
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Add-Ons */}
      <section className="section">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900">Need more? Add what you need.</h2>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
            {addOns.map((addon) => (
              <div
                key={addon.name}
                className="flex items-center justify-between rounded-lg border border-stone-200 bg-white p-4"
              >
                <div>
                  <h3 className="font-medium text-stone-900">{addon.name}</h3>
                  <p className="text-sm text-stone-500">{addon.note}</p>
                </div>
                <p className="text-lg font-semibold text-stone-900">{addon.price}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section bg-stone-100">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900">Frequently asked questions</h2>
          </div>
          <div className="mx-auto mt-12 max-w-3xl divide-y divide-stone-200">
            {faqs.map((faq) => (
              <div key={faq.question} className="py-6">
                <h3 className="font-semibold text-stone-900">{faq.question}</h3>
                <p className="mt-2 text-stone-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section bg-spice-500">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-white">
              Start understanding your community today
            </h2>
            <p className="mt-4 text-lg text-spice-100">
              Free forever to get started. Upgrade when conviction data proves its value.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="btn bg-white text-spice-600 hover:bg-stone-100"
              >
                Start Free
              </Link>
              <Link
                href="/contact"
                className="btn border-2 border-white bg-transparent text-white hover:bg-spice-600"
              >
                Contact Sales
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-spice-200">
              <span>No credit card required for Free</span>
              <span>•</span>
              <span>Cancel anytime</span>
              <span>•</span>
              <span>30-day money-back on annual plans</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) {
    return <CheckCircle2 className="mx-auto h-5 w-5 text-green-500" />;
  }
  if (value === false) {
    return <X className="mx-auto h-5 w-5 text-stone-300" />;
  }
  if (value === '—') {
    return <span className="text-stone-300">—</span>;
  }
  return <span className="text-sm text-stone-600">{value}</span>;
}
