import Link from 'next/link';
import type { Metadata } from 'next';
import { Medal, ChartLineUp, Users, Gear, Clock, ShieldCheck, Diamond, Check as CheckIcon, Minus, Cube, Graph, Buildings, Lock, Info } from '@phosphor-icons/react/dist/ssr';
import { FAQAccordion } from '@/components/FAQAccordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Table icons
const Check = () => (
  <CheckIcon weight="bold" className="w-4 h-4 text-spice mx-auto" />
);

const Dash = () => (
  <Minus weight="bold" className="w-4 h-4 text-sand-dim/50 mx-auto" />
);

// Info tooltip component
const InfoTooltip = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider delayDuration={0}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Info weight="fill" className="w-3.5 h-3.5 text-sand-dim hover:text-sand-bright cursor-help inline-block ml-1.5" />
      </TooltipTrigger>
      <TooltipContent className="bg-black border border-sand-dim/30 text-sand text-xs max-w-xs">
        {children}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const metadata: Metadata = {
  title: 'Pricing // ARRAKIS',
  description: 'Simple pricing for Dune-powered community intelligence. Start free, scale as you grow.',
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 pb-20">
      {/* Header + Pricing Grid - full viewport */}
      <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center">
        <div className="mb-12">
          <h1 className="font-display text-3xl lg:text-4xl text-sand-bright mb-4">
            Simple pricing. Scale as you grow.
          </h1>
          <p className="text-sand text-base max-w-lg">
            Start free with essential features. Upgrade when you need conviction scoring,
            more tiers, or multi-server support.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid md:grid-cols-3 gap-0">
        {/* Starter */}
        <div className="flex flex-col">
          <div className="border border-sand-dim/30 p-8 flex flex-col flex-1">
            <div className="font-display text-xl text-sand-bright mb-2">Starter</div>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="font-display text-4xl text-sand-bright">$0</span>
              <span className="text-sand-dim text-sm">per month</span>
            </div>

            {/* Features - aligned with other columns */}
            <div className="space-y-4 text-sm flex-1">
              <div className="flex items-center gap-3">
                <Medal weight="fill" className="w-4 h-4 text-sand-dim shrink-0" />
                <span className="text-sand">3 tiers</span>
              </div>
              <div className="flex items-center gap-3">
                <Users weight="fill" className="w-4 h-4 text-sand-dim shrink-0" />
                <span className="text-sand">1 server</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock weight="fill" className="w-4 h-4 text-sand-dim shrink-0" />
                <span className="text-sand">24 hour refresh</span>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck weight="fill" className="w-4 h-4 text-sand-dim shrink-0" />
                <span className="text-sand">Basic token gating</span>
              </div>
              <div className="flex items-center gap-3">
                <Gear weight="fill" className="w-4 h-4 text-sand-dim shrink-0" />
                <span className="text-sand">Shadow mode</span>
              </div>
            </div>

            <Link
              href="https://discord.gg/thehoneyjar"
              className="block w-full text-center px-4 py-3 border border-sand-dim/40 text-sand font-mono text-sm uppercase tracking-wider hover:border-sand hover:text-sand-bright transition-colors duration-150 mt-8"
            >
              Start Free
            </Link>
          </div>
          {/* Empty footer to align with other columns */}
          <div className="h-10" />
        </div>

        {/* Growth - Popular */}
        <div className="flex flex-col">
          <div className="border-y border-x md:border border-sand-dim/30 md:border-spice/50 p-8 relative flex flex-col flex-1 bg-sand-dim/5">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-spice px-3 py-1 text-xs text-black font-mono tracking-wider">
              POPULAR
            </div>
            <div className="font-display text-xl text-sand-bright mb-2">Growth</div>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="font-display text-4xl text-sand-bright">$99</span>
              <span className="text-sand-dim text-sm">per month</span>
            </div>

            {/* Features - aligned with other columns */}
            <div className="space-y-4 text-sm flex-1">
              <div className="flex items-center gap-3">
                <Medal weight="fill" className="w-4 h-4 text-sand-dim shrink-0" />
                <span className="text-sand-bright">9 tiers</span>
              </div>
              <div className="flex items-center gap-3">
                <Users weight="fill" className="w-4 h-4 text-sand-dim shrink-0" />
                <span className="text-sand-bright">5 servers</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock weight="fill" className="w-4 h-4 text-sand-dim shrink-0" />
                <span className="text-sand-bright">6 hour refresh</span>
              </div>
              <div className="flex items-center gap-3">
                <ChartLineUp weight="fill" className="w-4 h-4 text-sand-dim shrink-0" />
                <span className="text-sand">Analytics dashboard</span>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck weight="fill" className="w-4 h-4 text-sand-dim shrink-0" />
                <span className="text-sand">Priority support</span>
              </div>
            </div>

            <Link
              href="https://discord.gg/thehoneyjar"
              className="block w-full text-center px-4 py-3 bg-spice text-black font-mono text-sm uppercase tracking-wider transition-colors duration-150 mt-8"
            >
              Get Started
            </Link>
          </div>
          {/* Includes Conviction Scoring - outside card */}
          <div className="flex items-center justify-center gap-2 py-3 border border-t-0 border-sand-dim/30">
            <div className="w-4 h-4 flex items-center justify-center shrink-0" style={{ backgroundColor: '#c45c4a' }}>
              <Diamond weight="fill" className="w-2.5 h-2.5 text-black" />
            </div>
            <span className="text-sand-dim text-xs">Includes</span>
            <span className="text-sand-bright text-xs font-semibold">Conviction Scoring</span>
          </div>
        </div>

        {/* Enterprise */}
        <div className="flex flex-col">
          <div className="border border-l-0 md:border-l border-sand-dim/30 p-8 flex flex-col flex-1">
            <div className="font-display text-xl text-sand-bright mb-2">Enterprise</div>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="font-display text-4xl text-sand-bright">$399</span>
              <span className="text-sand-dim text-sm">per month</span>
            </div>

            {/* Features - aligned with other columns */}
            <div className="space-y-4 text-sm flex-1">
              <div className="flex items-center gap-3">
                <Medal weight="fill" className="w-4 h-4 text-sand-dim shrink-0" />
                <span className="text-sand-bright">Unlimited tiers</span>
              </div>
              <div className="flex items-center gap-3">
                <Users weight="fill" className="w-4 h-4 text-sand-dim shrink-0" />
                <span className="text-sand-bright">Unlimited servers</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock weight="fill" className="w-4 h-4 text-sand-dim shrink-0" />
                <span className="text-sand-bright">1 hour refresh</span>
              </div>
              <div className="flex items-center gap-3">
                <Gear weight="fill" className="w-4 h-4 text-sand-dim shrink-0" />
                <span className="text-sand">Custom branding</span>
              </div>
              <div className="flex items-center gap-3">
                <ChartLineUp weight="fill" className="w-4 h-4 text-sand-dim shrink-0" />
                <span className="text-sand">API access</span>
              </div>
            </div>

            <Link
              href="https://discord.gg/thehoneyjar"
              className="block w-full text-center px-4 py-3 border border-sand-dim/40 text-sand font-mono text-sm uppercase tracking-wider hover:border-sand hover:text-sand-bright transition-colors duration-150 mt-8"
            >
              Contact Us
            </Link>
          </div>
          {/* Includes Conviction Scoring - outside card */}
          <div className="flex items-center justify-center gap-2 py-3 border border-t-0 border-sand-dim/30">
            <div className="w-4 h-4 flex items-center justify-center shrink-0" style={{ backgroundColor: '#c45c4a' }}>
              <Diamond weight="fill" className="w-2.5 h-2.5 text-black" />
            </div>
            <span className="text-sand-dim text-xs">Includes</span>
            <span className="text-sand-bright text-xs font-semibold">Conviction Scoring</span>
          </div>
        </div>
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="mb-20">
        <h2 className="font-display text-2xl text-sand-bright mb-8">
          Compare features
        </h2>
        <div className="border border-sand-dim/30 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-4 border-b border-sand-dim/30 bg-sand-dim/5">
            <div className="p-4 text-sand-dim text-sm">Features</div>
            <div className="p-4 text-sand-bright text-sm text-center border-l border-sand-dim/30">Starter</div>
            <div className="p-4 text-sand-bright text-sm text-center border-l border-sand-dim/30">Growth</div>
            <div className="p-4 text-sand-bright text-sm text-center border-l border-sand-dim/30">Enterprise</div>
          </div>

          {/* Section: Token Gating */}
          <div className="border-b border-sand-dim/30 bg-sand-dim/10">
            <div className="p-4 flex items-center gap-2">
              <Lock weight="fill" className="w-4 h-4 text-spice" />
              <span className="text-sand-bright text-xs font-mono uppercase tracking-wider">Token Gating</span>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center border-b border-sand-dim/20">
            <div className="p-4 text-sand text-sm">ERC20 gating</div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
          </div>

          <div className="grid grid-cols-4 items-center border-b border-sand-dim/20">
            <div className="p-4 text-sand text-sm">NFT gating</div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
          </div>

          <div className="grid grid-cols-4 items-center border-b border-sand-dim/20">
            <div className="p-4 text-sand text-sm">Multi-chain</div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
          </div>

          <div className="grid grid-cols-4 items-center border-b border-sand-dim/20">
            <div className="p-4 text-sand text-sm flex items-center">
              Shadow mode
              <InfoTooltip>
                Run Arrakis alongside Collab.Land or Guild.xyz. See conviction data without switching. Zero risk adoption.
              </InfoTooltip>
            </div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
          </div>

          {/* Section: Progression */}
          <div className="border-b border-sand-dim/30 bg-sand-dim/10">
            <div className="p-4 flex items-center gap-2">
              <Medal weight="fill" className="w-4 h-4 text-spice" />
              <span className="text-sand-bright text-xs font-mono uppercase tracking-wider">Progression</span>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center border-b border-sand-dim/20">
            <div className="p-4 text-sand text-sm">Tier system</div>
            <div className="p-4 text-sand-dim text-sm text-center border-l border-sand-dim/20">3</div>
            <div className="p-4 text-sand-bright text-sm text-center border-l border-sand-dim/20">9</div>
            <div className="p-4 text-sand-bright text-sm text-center border-l border-sand-dim/20">Custom</div>
          </div>

          <div className="grid grid-cols-4 items-center border-b border-sand-dim/20">
            <div className="p-4 text-sand text-sm">Badges</div>
            <div className="p-4 text-sand-dim text-sm text-center border-l border-sand-dim/20">5</div>
            <div className="p-4 text-sand-bright text-sm text-center border-l border-sand-dim/20">10+</div>
            <div className="p-4 text-sand-bright text-sm text-center border-l border-sand-dim/20">Unlimited</div>
          </div>

          <div className="grid grid-cols-4 items-center border-b border-sand-dim/20">
            <div className="p-4 text-sand text-sm">Badge lineage</div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Dash /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
          </div>

          {/* Section: Intelligence */}
          <div className="border-b border-sand-dim/30 bg-sand-dim/10">
            <div className="p-4 flex items-center gap-2">
              <Graph weight="fill" className="w-4 h-4 text-spice" />
              <span className="text-sand-bright text-xs font-mono uppercase tracking-wider">Intelligence</span>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center border-b border-sand-dim/20">
            <div className="p-4 text-sand text-sm">Conviction score</div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Dash /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
          </div>

          <div className="grid grid-cols-4 items-center border-b border-sand-dim/20">
            <div className="p-4 text-sand text-sm">Analytics</div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Dash /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
          </div>

          <div className="grid grid-cols-4 items-center border-b border-sand-dim/20">
            <div className="p-4 text-sand text-sm">Holder insights</div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Dash /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
          </div>

          {/* Section: Platform */}
          <div className="border-b border-sand-dim/30 bg-sand-dim/10">
            <div className="p-4 flex items-center gap-2">
              <Cube weight="fill" className="w-4 h-4 text-spice" />
              <span className="text-sand-bright text-xs font-mono uppercase tracking-wider">Platform</span>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center border-b border-sand-dim/20">
            <div className="p-4 text-sand text-sm">Discord servers</div>
            <div className="p-4 text-sand-dim text-sm text-center border-l border-sand-dim/20">1</div>
            <div className="p-4 text-sand-bright text-sm text-center border-l border-sand-dim/20">3</div>
            <div className="p-4 text-sand-bright text-sm text-center border-l border-sand-dim/20">Unlimited</div>
          </div>

          <div className="grid grid-cols-4 items-center border-b border-sand-dim/20">
            <div className="p-4 text-sand text-sm">Telegram groups</div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Dash /></div>
            <div className="p-4 text-sand-bright text-sm text-center border-l border-sand-dim/20">1</div>
            <div className="p-4 text-sand-bright text-sm text-center border-l border-sand-dim/20">Unlimited</div>
          </div>

          <div className="grid grid-cols-4 items-center border-b border-sand-dim/20">
            <div className="p-4 text-sand text-sm">Refresh interval</div>
            <div className="p-4 text-sand-dim text-sm text-center border-l border-sand-dim/20">24 hours</div>
            <div className="p-4 text-sand-bright text-sm text-center border-l border-sand-dim/20">6 hours</div>
            <div className="p-4 text-sand-bright text-sm text-center border-l border-sand-dim/20">1 hour</div>
          </div>

          <div className="grid grid-cols-4 items-center border-b border-sand-dim/20">
            <div className="p-4 text-sand text-sm">API access</div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Dash /></div>
            <div className="p-4 text-sand-dim text-sm text-center border-l border-sand-dim/20">Read</div>
            <div className="p-4 text-sand-bright text-sm text-center border-l border-sand-dim/20">Full</div>
          </div>

          {/* Section: Security */}
          <div className="border-b border-sand-dim/30 bg-sand-dim/10">
            <div className="p-4 flex items-center gap-2">
              <ShieldCheck weight="fill" className="w-4 h-4 text-spice" />
              <span className="text-sand-bright text-xs font-mono uppercase tracking-wider">Security</span>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center border-b border-sand-dim/20">
            <div className="p-4 text-sand text-sm">Row-level security</div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
          </div>

          <div className="grid grid-cols-4 items-center border-b border-sand-dim/20">
            <div className="p-4 text-sand text-sm">Audit trail</div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Dash /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Dash /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
          </div>

          <div className="grid grid-cols-4 items-center">
            <div className="p-4 text-sand text-sm">White-label</div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Dash /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Dash /></div>
            <div className="p-4 text-center border-l border-sand-dim/20"><Check /></div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mb-16">
        <h2 className="font-display text-2xl text-sand-bright mb-8">
          Frequently asked questions
        </h2>
        <FAQAccordion />
      </div>

    </div>
  );
}
