import Link from 'next/link';
import {
  Diamond,
  Layers,
  Award,
  Shield,
  Zap,
  Users,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="section bg-gradient-to-b from-stone-100 to-stone-50">
        <div className="container-custom">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-spice-100 px-4 py-2 text-sm font-medium text-spice-700">
              <Sparkles className="h-4 w-4" />
              Built by the #1 starred team on Dune Analytics
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl md:text-6xl">
              Know your community,
              <br />
              <span className="text-spice-500">not just your holders.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-stone-600 md:text-xl">
              Arrakis identifies your most valuable members through conviction
              scoring and rewards them with tiered progression. Try it alongside
              your current setup — zero risk.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/signup" className="btn-primary text-lg">
                Start Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link href="/demo" className="btn-secondary text-lg">
                Watch Demo (2 min)
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="section">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900 md:text-4xl">
              Token-gating is table stakes.
              <br />
              Engagement intelligence is the future.
            </h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <ProblemCard
              title="Same Balance, Different Believers"
              description="Everyone with 100 tokens looks the same. But someone who held through the bear market is not the same as someone who bought yesterday."
            />
            <ProblemCard
              title="Airdrops Go to Farmers"
              description="Millions in tokens distributed to bots and mercenaries. Your real community gets diluted."
            />
            <ProblemCard
              title="Flat Discord Experience"
              description="Your biggest supporters get the same experience as day-one flippers. No recognition, no progression, no reason to stay engaged."
            />
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="section bg-stone-100">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900 md:text-4xl">
              Arrakis brings intelligence to your community
            </h2>
            <p className="mt-4 text-lg text-stone-600">
              We analyze on-chain behavior — holding duration, trading patterns,
              activity history — to identify who truly believes in your project.
              Then we create experiences that reward them.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={Diamond}
              title="Conviction Scoring"
              description="Know who your diamond hands are before your next airdrop. Our scoring goes beyond balance to measure true commitment."
            />
            <FeatureCard
              icon={Layers}
              title="9-Tier Progression"
              description="From Outsider to Naib council. Your top holders earn visible status that drives engagement, not just access."
            />
            <FeatureCard
              icon={Award}
              title="Badge Gamification"
              description="10+ badge types for tenure, achievements, and community contribution. Create collector culture in your Discord."
            />
            <FeatureCard
              icon={Shield}
              title="Zero-Risk Adoption"
              description="Shadow mode runs alongside Collab.Land or Guild.xyz. See your conviction data, validate accuracy, switch when ready."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="section">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900 md:text-4xl">
              Set up in 15 minutes. No code required.
            </h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <StepCard
              step={1}
              title="Connect Your Token"
              description="Enter your contract address. We support all major EVM chains."
            />
            <StepCard
              step={2}
              title="Configure Tiers"
              description="Choose your progression system — BasicTheme (free) or SietchTheme (premium). Set your thresholds."
            />
            <StepCard
              step={3}
              title="Deploy"
              description="Our wizard handles everything. Roles, channels, and permissions created automatically."
            />
          </div>
          <div className="mt-12 text-center">
            <p className="text-lg text-stone-600">
              Your community now has conviction-based tiers, automatic
              progression, and engagement intelligence.
            </p>
          </div>
        </div>
      </section>

      {/* Features Overview Section */}
      <section className="section bg-stone-100">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900 md:text-4xl">
              Everything you need to understand and engage your community
            </h2>
          </div>
          <div className="mx-auto mt-12 max-w-4xl overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-stone-300">
                  <th className="pb-4 pr-8 text-sm font-semibold text-stone-900">
                    Feature
                  </th>
                  <th className="pb-4 pr-8 text-center text-sm font-semibold text-stone-900">
                    Free
                  </th>
                  <th className="pb-4 text-center text-sm font-semibold text-stone-900">
                    Premium
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                <FeatureRow feature="Token-gating (all chains)" free premium />
                <FeatureRow feature="Tier progression" free="3 tiers" premium="9 tiers" />
                <FeatureRow feature="Badge system" free="5 badges" premium="10+ badges" />
                <FeatureRow feature="Conviction scoring" premium />
                <FeatureRow feature="Analytics dashboard" premium />
                <FeatureRow feature="Shadow mode" free premium />
              </tbody>
            </table>
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/features"
              className="inline-flex items-center text-spice-600 hover:text-spice-700"
            >
              See all features
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Preview Section */}
      <section className="section">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900 md:text-4xl">
              Start free. Upgrade when you&apos;re ready.
            </h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <PricingCard
              tier="Free"
              price="$0"
              description="BasicTheme (3 tiers), token-gating, 1 Discord server"
              cta="Start Free"
              ctaHref="/signup"
            />
            <PricingCard
              tier="Premium"
              price="$99"
              description="SietchTheme (9 tiers), conviction scoring, analytics dashboard"
              cta="Start Premium"
              ctaHref="/signup?plan=premium"
              featured
            />
            <PricingCard
              tier="Enterprise"
              price="$399"
              description="Custom themes, unlimited servers, API access"
              cta="Contact Sales"
              ctaHref="/contact"
            />
          </div>
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-spice-100 px-4 py-2 text-sm font-medium text-spice-700">
              🎁 Founding 50: First 50 Premium customers get 50% off for life
            </div>
          </div>
          <div className="mt-6 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center text-spice-600 hover:text-spice-700"
            >
              View full pricing
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="section bg-stone-100">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900 md:text-4xl">
              Built for Web3 communities of all types
            </h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <UseCaseCard
              icon={Users}
              title="DAOs"
              description="Find your diamond hands before governance votes and airdrops. Increase participation with tiered recognition."
              href="/use-cases/daos"
            />
            <UseCaseCard
              icon={Sparkles}
              title="NFT Projects"
              description="Turn post-mint silence into engaged collector culture. Reward your OGs, convert floor-watchers to believers."
              href="/use-cases/nft-projects"
            />
            <UseCaseCard
              icon={BarChart3}
              title="DeFi Protocols"
              description="Enterprise-grade community infrastructure with security, audit trails, and scale for protocol-level operations."
              href="/use-cases/defi-protocols"
            />
          </div>
        </div>
      </section>

      {/* Credibility Section */}
      <section className="section">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-stone-900 md:text-4xl">
              Built by the #1 team on Dune Analytics
            </h2>
            <p className="mt-4 text-lg text-stone-600">
              We&apos;ve spent years analyzing on-chain data, building the
              most-starred dashboards on Dune. Arrakis is where we apply that
              expertise to community management.
            </p>
            <p className="mt-4 text-lg font-medium text-stone-700">
              65+ sprints of hardening. Enterprise-grade PostgreSQL with
              row-level security. Two-tier architecture for 99.9% uptime.
            </p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard value="65+" label="Development Sprints" />
            <StatCard value="#1" label="Starred Dune Team" />
            <StatCard value="99.9%" label="Uptime Target" />
            <StatCard value="RLS" label="Enterprise Security" />
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="section bg-spice-500">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              Ready to know your community?
            </h2>
            <p className="mt-4 text-lg text-spice-100">
              Start with our free tier. See your conviction data in shadow mode.
              Upgrade when you&apos;re confident.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="btn bg-white text-spice-600 hover:bg-stone-100"
              >
                Start Free — No credit card required
              </Link>
              <Link
                href="/demo"
                className="btn border-2 border-white bg-transparent text-white hover:bg-spice-600"
              >
                Schedule a Demo
              </Link>
            </div>
            <p className="mt-6 text-sm text-spice-200">
              🎁 Founding 50 spots remaining
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

// Component definitions

function ProblemCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
      <p className="mt-2 text-stone-600">{description}</p>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-spice-100">
        <Icon className="h-6 w-6 text-spice-600" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-stone-900">{title}</h3>
      <p className="mt-2 text-stone-600">{description}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-spice-500 text-xl font-bold text-white">
        {step}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-stone-900">{title}</h3>
      <p className="mt-2 text-stone-600">{description}</p>
    </div>
  );
}

function FeatureRow({
  feature,
  free,
  premium,
}: {
  feature: string;
  free?: boolean | string;
  premium?: boolean | string;
}) {
  return (
    <tr>
      <td className="py-4 pr-8 text-sm text-stone-900">{feature}</td>
      <td className="py-4 pr-8 text-center">
        {free === true ? (
          <CheckCircle2 className="mx-auto h-5 w-5 text-green-500" />
        ) : free ? (
          <span className="text-sm text-stone-600">{free}</span>
        ) : (
          <span className="text-stone-300">—</span>
        )}
      </td>
      <td className="py-4 text-center">
        {premium === true ? (
          <CheckCircle2 className="mx-auto h-5 w-5 text-green-500" />
        ) : premium ? (
          <span className="text-sm text-stone-600">{premium}</span>
        ) : (
          <span className="text-stone-300">—</span>
        )}
      </td>
    </tr>
  );
}

function PricingCard({
  tier,
  price,
  description,
  cta,
  ctaHref,
  featured,
}: {
  tier: string;
  price: string;
  description: string;
  cta: string;
  ctaHref: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        featured
          ? 'border-spice-500 bg-white ring-2 ring-spice-500'
          : 'border-stone-200 bg-white'
      }`}
    >
      {featured && (
        <span className="mb-4 inline-block rounded-full bg-spice-100 px-3 py-1 text-xs font-semibold text-spice-700">
          Most Popular
        </span>
      )}
      <h3 className="text-lg font-semibold text-stone-900">{tier}</h3>
      <div className="mt-2">
        <span className="text-3xl font-bold text-stone-900">{price}</span>
        <span className="text-stone-500">/month</span>
      </div>
      <p className="mt-4 text-sm text-stone-600">{description}</p>
      <Link
        href={ctaHref}
        className={`mt-6 block w-full rounded-lg py-2 text-center text-sm font-medium ${
          featured
            ? 'bg-spice-500 text-white hover:bg-spice-600'
            : 'bg-stone-100 text-stone-900 hover:bg-stone-200'
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

function UseCaseCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-spice-100">
        <Icon className="h-6 w-6 text-spice-600" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-stone-900">{title}</h3>
      <p className="mt-2 text-stone-600">{description}</p>
      <span className="mt-4 inline-flex items-center text-sm font-medium text-spice-600 group-hover:text-spice-700">
        Learn more
        <ArrowRight className="ml-1 h-4 w-4" />
      </span>
    </Link>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-spice-500">{value}</div>
      <div className="mt-1 text-sm text-stone-600">{label}</div>
    </div>
  );
}
