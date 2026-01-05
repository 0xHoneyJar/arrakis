import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Diamond,
  Layers,
  BarChart3,
  Wrench,
  ArrowRight,
  CheckCircle2,
  Users,
  Vote,
  Coins,
  Shield,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Arrakis for DAOs - Find Your Diamond Hands',
  description:
    'Identify your most committed members before airdrops and governance votes. Conviction scoring for DAOs that want to reward true believers.',
};

const problems = [
  {
    title: 'Everyone Looks the Same',
    description:
      "Token balance doesn't tell you who held through the bear market versus who bought yesterday. Your oldest supporters are invisible.",
  },
  {
    title: 'Airdrops Go to Farmers',
    description:
      'You spend months planning a fair distribution. Then bots and mercenaries claim 60%+ of it. Your real community gets diluted.',
  },
  {
    title: '5% Governance Participation',
    description:
      'Thousands of token holders, but only a handful vote. The people who care most have no special recognition or incentive.',
  },
  {
    title: 'Tool Sprawl',
    description:
      "Collab.Land for gating. MEE6 for levels. Guild.xyz for requirements. Custom scripts for snapshots. It's a mess.",
  },
];

const capabilities = [
  {
    icon: Diamond,
    title: 'Conviction Scoring for Airdrops',
    description:
      'Know who your diamond hands are before you distribute. Our scoring analyzes holding duration, trading patterns, and activity to separate believers from farmers.',
    result: 'Fair airdrops that reward contribution, not exploitation.',
  },
  {
    icon: Layers,
    title: 'Tiered Governance Recognition',
    description:
      'Your Naib council (top 7 holders) gets visible status. Fedaykin Elite have their own channels. Create a hierarchy that reflects commitment.',
    result: 'Governance participation increases when members feel recognized.',
  },
  {
    icon: BarChart3,
    title: 'Pre-Airdrop Planning',
    description:
      'Export conviction data for your snapshot. Identify which addresses should be excluded (recent buyers, known farmers) and which deserve extra allocation.',
    result: "Distribution that aligns with your DAO's values.",
  },
  {
    icon: Wrench,
    title: 'Consolidated Tooling',
    description:
      'Replace your Collab.Land + MEE6 + custom scripts stack with one platform. Token-gating, tiers, badges, and analytics in one place.',
    result: 'Less maintenance, clearer operations.',
  },
];

const useCases = [
  {
    title: 'Fair Airdrop Distribution',
    scenario:
      "Your DAO is planning a major airdrop. Last time, farmers claimed most of it. This time needs to be different.",
    steps: [
      'Run shadow mode to see conviction scores for all holders',
      'Identify diamond hands (high conviction) vs recent buyers (low conviction)',
      'Export data for your snapshot tool',
      'Weight distribution by conviction, not just balance',
      'Execute airdrop with confidence',
    ],
    outcome:
      "Tokens go to members who've been contributing for months, not accounts that appeared last week.",
  },
  {
    title: 'Governance Engagement',
    scenario:
      'Your governance proposals get 3-5% participation. Critical votes pass with a handful of wallets. You need more engagement.',
    steps: [
      'Implement 9-tier progression based on conviction',
      'Create Naib-only governance channels for top members',
      'Award "Voter" badges for participation',
      'Surface diamond hands in your Discord',
      'Recognize contributors publicly',
    ],
    outcome:
      'Members see a path to status. Participation increases because engagement is visible and rewarded.',
  },
  {
    title: 'Operational Consolidation',
    scenario:
      "You're running Collab.Land for gating, MEE6 for XP, Guild.xyz for some requirements, and custom scripts for analytics. It's fragile and time-consuming.",
    steps: [
      'Start in shadow mode alongside existing tools',
      'Validate conviction data accuracy',
      'Migrate tier roles to Arrakis',
      'Sunset redundant bots',
      'Manage everything from one platform',
    ],
    outcome:
      'One tool instead of four. Less maintenance, clearer member experience.',
  },
];

const features = [
  { feature: 'Conviction Scoring', use: 'Identify true believers for airdrops and governance' },
  { feature: '9-Tier Progression', use: 'Create council hierarchy (Naib, Fedaykin, Fremen...)' },
  { feature: 'Badge System', use: 'Recognize tenure, achievements, contributions' },
  { feature: 'Shadow Mode', use: 'Try alongside Collab.Land before switching' },
  { feature: 'Analytics Dashboard', use: 'Understand community composition' },
  { feature: 'Multi-Chain', use: 'Aggregate holdings across L2s and mainnet' },
];

const objections = [
  {
    question: 'We already use Collab.Land',
    answer:
      "Perfect — Arrakis runs in shadow mode alongside it. See your conviction data without changing anything. Collab.Land tells you who holds tokens. Arrakis tells you who believes.",
  },
  {
    question: 'Our community is used to the current setup',
    answer:
      "Tiered progression adds to their experience, it doesn't change what works. Your diamond hands finally get recognized. That's a feature, not a disruption.",
  },
  {
    question: 'How do we know conviction scoring works?',
    answer:
      "We'll show you your data in shadow mode. You validate before committing. If our scoring doesn't match your intuition about who your believers are, don't switch.",
  },
  {
    question: "We're a treasury-funded DAO with limited budget",
    answer:
      "Premium is $99/month — less than $1,200/year from your treasury. One prevented farmer-captured airdrop pays for decades of Arrakis.",
  },
];

export default function DAOsPage() {
  return (
    <>
      {/* Hero */}
      <section className="section bg-gradient-to-b from-stone-100 to-stone-50">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-spice-100 px-4 py-2 text-sm font-medium text-spice-700">
              <Users className="h-4 w-4" />
              For DAOs
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
              Find your diamond hands before your next airdrop
            </h1>
            <p className="mt-6 text-lg text-stone-600">
              Your DAO has thousands of token holders. But how many are true
              believers? Arrakis identifies your most committed members through
              conviction scoring — so your governance gets real participation and
              your airdrops go to real supporters.
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
            <h2 className="text-3xl font-bold text-stone-900">
              The engagement problem every DAO faces
            </h2>
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
              Arrakis brings engagement intelligence to your DAO
            </h2>
            <p className="mt-4 text-lg text-stone-600">
              We analyze on-chain behavior to identify who truly believes in your
              DAO — then create tiered experiences that reward them.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {capabilities.map((cap) => (
              <div key={cap.title} className="rounded-xl bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-spice-100">
                  <cap.icon className="h-6 w-6 text-spice-600" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-stone-900">
                  {cap.title}
                </h3>
                <p className="mt-2 text-stone-600">{cap.description}</p>
                <p className="mt-4 text-sm font-medium text-spice-600">
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
              How DAOs Use Arrakis
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
                    <span className="text-sm font-medium text-spice-600">
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
                          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-spice-100 text-xs font-bold text-spice-700">
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
              Features for DAOs
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
                      How DAOs Use It
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
          <div className="mx-auto mt-12 max-w-3xl grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border-2 border-spice-500 bg-white p-6">
              <span className="rounded-full bg-spice-100 px-3 py-1 text-xs font-semibold text-spice-700">
                Recommended
              </span>
              <h3 className="mt-4 text-lg font-bold text-stone-900">
                Premium ($99/mo)
              </h3>
              <p className="mt-1 text-sm text-stone-500">For most DAOs</p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Conviction scoring for airdrops
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  9-tier progression for governance hierarchy
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Analytics for decision-making
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Up to 3 Discord servers
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-6">
              <h3 className="text-lg font-bold text-stone-900">
                Enterprise ($399/mo)
              </h3>
              <p className="mt-1 text-sm text-stone-500">For large DAOs</p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Unlimited servers for multi-community ops
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  API access for custom tooling
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Audit trail for compliance
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Custom themes for branding
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
              Start in 15 minutes
            </h2>
          </div>
          <div className="mx-auto mt-12 max-w-2xl">
            <div className="space-y-4">
              {[
                { step: 'Install Arrakis', desc: 'Add the bot to your Discord server' },
                { step: 'Enter Your Token', desc: 'Contract address, we detect the rest' },
                { step: 'Configure Tiers', desc: 'Choose SietchTheme for 9-tier progression' },
                { step: 'Enable Shadow Mode', desc: 'See conviction data alongside your current setup' },
                { step: 'Review & Validate', desc: 'Confirm scoring matches your intuition' },
                { step: 'Go Live', desc: 'Switch from shadow to primary when ready' },
              ].map((s, i) => (
                <div key={s.step} className="flex items-center gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-spice-500 text-white font-bold">
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
      <section className="section bg-spice-500">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-white">
              Know your DAO, not just your token holders
            </h2>
            <p className="mt-4 text-lg text-spice-100">
              Start with shadow mode. See your conviction data. Upgrade when
              you&apos;re confident.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="btn bg-white text-spice-600 hover:bg-stone-100"
              >
                Start Free
              </Link>
              <Link
                href="/demo"
                className="btn border-2 border-white bg-transparent text-white hover:bg-spice-600"
              >
                Schedule Demo
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-spice-200">
              <span>No credit card required</span>
              <span>•</span>
              <span>Shadow mode = zero risk</span>
              <span>•</span>
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
