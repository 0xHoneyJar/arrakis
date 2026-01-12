import Link from 'next/link';
import { HeroSection } from '@/components/HeroSection';
import { StatsGrid } from '@/components/StatsGrid';
import { ConvictionBoard } from '@/components/ConvictionBoard';
import { TierCards } from '@/components/TierCards';
import { ChartLineUp, Diamond, Medal } from '@phosphor-icons/react/dist/ssr';

export default function HomePage() {
  return (
    <div>
      <HeroSection />

      <div className="space-y-48 relative z-10 mt-20">
        {/* Feature 1: On-chain Analytics */}
        <section className="mx-auto max-w-4xl px-6">
          <div className="flex items-center gap-2 mb-6">
            <div
              className="w-6 h-6 flex items-center justify-center"
              style={{ backgroundColor: '#f4a460' }}
            >
              <ChartLineUp weight="fill" className="w-4 h-4 text-black" />
            </div>
            <span className="text-sand-bright text-xs font-mono uppercase tracking-wider">On-chain Analytics</span>
          </div>
          <h2 className="font-display text-3xl lg:text-4xl text-sand-bright mb-4">
            Dune queries. Zero SQL.
          </h2>
          <p className="text-sand text-base mb-8 max-w-2xl">
            Years of Dune expertise in a 15-minute setup. Wallet activity, trading patterns, holding duration — no SQL required.
          </p>
          <Link
            href="#features"
            className="inline-flex items-center gap-2 text-spice hover:text-spice-bright font-mono text-sm transition-colors duration-150"
          >
            Learn more
            <span>→</span>
          </Link>
          {/* Visual */}
          <StatsGrid />
        </section>

        {/* Feature 2: Conviction Scoring */}
        <section className="mx-auto max-w-4xl px-6">
          <div className="flex items-center gap-2 mb-6">
            <div
              className="w-6 h-6 flex items-center justify-center"
              style={{ backgroundColor: '#c45c4a' }}
            >
              <Diamond weight="fill" className="w-4 h-4 text-black" />
            </div>
            <span className="text-sand-bright text-xs font-mono uppercase tracking-wider">Conviction Scoring</span>
          </div>
          <h2 className="font-display text-3xl lg:text-4xl text-sand-bright mb-4">
            Diamond hands. Quantified.
          </h2>
          <p className="text-sand text-base mb-8 max-w-2xl">
            Score holder commitment by holding duration, trading patterns, and on-chain activity. Reward believers, not flippers.
          </p>
          <Link
            href="#features"
            className="inline-flex items-center gap-2 text-spice hover:text-spice-bright font-mono text-sm transition-colors duration-150"
          >
            Learn more
            <span>→</span>
          </Link>
          {/* Visual */}
          <ConvictionBoard />
        </section>

        {/* Feature 3: Tier Progression */}
        <section className="mx-auto max-w-4xl px-6">
          <div className="flex items-center gap-2 mb-6">
            <div
              className="w-6 h-6 flex items-center justify-center"
              style={{ backgroundColor: '#5b8fb9' }}
            >
              <Medal weight="fill" className="w-4 h-4 text-black" />
            </div>
            <span className="text-sand-bright text-xs font-mono uppercase tracking-wider">Tier Progression</span>
          </div>
          <h2 className="font-display text-3xl lg:text-4xl text-sand-bright mb-4">
            From Outsider to Naib Council.
          </h2>
          <p className="text-sand text-base mb-8 max-w-2xl">
            Discord roles that reflect real conviction. Members climb tiers automatically — updates every 6 hours.
          </p>
          <Link
            href="#features"
            className="inline-flex items-center gap-2 text-spice hover:text-spice-bright font-mono text-sm transition-colors duration-150"
          >
            Learn more
            <span>→</span>
          </Link>
          {/* Visual */}
          <TierCards />
        </section>

      </div>
    </div>
  );
}
