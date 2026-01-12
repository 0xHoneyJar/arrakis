import Link from 'next/link';
import type { Metadata } from 'next';
import { Users, Coins, ImageSquare, Buildings, Handshake, Rocket } from '@phosphor-icons/react/dist/ssr';

export const metadata: Metadata = {
  title: 'Use Cases // ARRAKIS',
  description: 'See how DAOs, DeFi protocols, and NFT projects use Arrakis for on-chain community intelligence.',
};

const useCases = [
  {
    title: 'DAOs & Governance',
    description: 'Identify your most committed voters and delegates. Weight governance power by on-chain conviction, not just token count.',
    icon: Users,
    color: '#f4a460',
    benefits: [
      'Find engaged members for committees',
      'Reward long-term alignment',
      'Reduce plutocracy in voting',
    ],
  },
  {
    title: 'DeFi Protocols',
    description: 'Recognize power users and liquidity providers. Build loyalty programs that reward consistent protocol usage.',
    icon: Coins,
    color: '#c45c4a',
    benefits: [
      'Identify whale vs retail behavior',
      'Reward sticky liquidity',
      'Segment users by activity',
    ],
  },
  {
    title: 'NFT Projects',
    description: 'Separate diamond hands from flippers. Give your true believers exclusive access and recognition.',
    icon: ImageSquare,
    color: '#5b8fb9',
    benefits: [
      'Track holding duration',
      'Identify collectors vs traders',
      'Reward community builders',
    ],
  },
  {
    title: 'Token Communities',
    description: 'Build tiered access based on real conviction. Auto-update roles as on-chain behavior changes.',
    icon: Rocket,
    color: '#8b7355',
    benefits: [
      'Dynamic role assignment',
      'Conviction-weighted perks',
      'Anti-sybil protection',
    ],
  },
  {
    title: 'Investment DAOs',
    description: 'Qualify members by their track record. Surface analysts with proven on-chain alpha.',
    icon: Buildings,
    color: '#6b8e6b',
    benefits: [
      'Verify investment history',
      'Track member performance',
      'Weight voting by expertise',
    ],
  },
  {
    title: 'Partnerships & BD',
    description: 'Identify high-value community members for partnerships, ambassadors, and collaborations.',
    icon: Handshake,
    color: '#9b7bb8',
    benefits: [
      'Find potential partners',
      'Qualify ambassador candidates',
      'Surface power users',
    ],
  },
];

export default function UseCasesPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 pb-20">
      {/* Header */}
      <div className="pt-24 mb-16">
        <p className="text-sand-dim text-xs font-mono mb-4 uppercase tracking-wider">
          Use Cases
        </p>
        <h1 className="font-display text-3xl lg:text-4xl text-sand-bright mb-4">
          Built for on-chain communities.
        </h1>
        <p className="text-sand text-base max-w-lg">
          From DAOs to DeFi protocols to NFT projects — Arrakis helps you understand and reward your most committed members.
        </p>
      </div>

      {/* Use Cases Grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-20">
        {useCases.map((useCase) => {
          const Icon = useCase.icon;
          return (
            <div
              key={useCase.title}
              className="border border-sand-dim/30 p-6 hover:border-sand-dim/50 transition-colors duration-150"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 flex items-center justify-center"
                  style={{ backgroundColor: useCase.color }}
                >
                  <Icon weight="fill" className="w-5 h-5 text-black" />
                </div>
                <h2 className="font-display text-xl text-sand-bright">
                  {useCase.title}
                </h2>
              </div>
              <p className="text-sand text-sm mb-4 leading-relaxed">
                {useCase.description}
              </p>
              <ul className="space-y-2">
                {useCase.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2 text-sand-dim text-xs">
                    <span className="text-spice">+</span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="text-center">
        <h2 className="font-display text-2xl text-sand-bright mb-4">
          Ready to know your community?
        </h2>
        <p className="text-sand text-sm mb-8 max-w-md mx-auto">
          Set up Arrakis in 15 minutes. No SQL required.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="https://discord.gg/thehoneyjar"
            className="px-5 py-2.5 bg-spice text-black font-mono text-sm uppercase tracking-wider hover:bg-spice-bright transition-colors duration-150"
          >
            Get Started
          </Link>
          <Link
            href="/pricing"
            className="px-5 py-2.5 border border-sand-dim text-sand font-mono text-sm uppercase tracking-wider hover:border-sand-bright hover:text-sand-bright transition-colors duration-150"
          >
            View Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
