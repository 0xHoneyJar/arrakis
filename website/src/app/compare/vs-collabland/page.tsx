import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'vs collab.land // ARRAKIS',
  description:
    'Collab.Land gates the door. Arrakis creates the journey. Compare engagement intelligence vs access control.',
};

export default function VsCollabLandPage() {
  return (
    <div className="space-y-16">
      {/* Header */}
      <section>
        <div className="text-sand-dim text-xs mb-2">// compare / vs-collabland</div>
        <h1 className="text-2xl text-sand-bright">
          collab.land gates the door. arrakis creates the journey.
        </h1>
        <p className="text-sand mt-2">
          collab.land is the industry standard for token-gating. but access control
          is just the beginning. arrakis adds engagement intelligence — so you know
          who matters, not just who can enter.
        </p>
      </section>

      {/* Quick Comparison */}
      <section>
        <div className="text-sand-dim text-xs mb-4">// quick_comparison</div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-spice/50 p-4">
            <div className="text-spice mb-3">ARRAKIS</div>
            <div className="text-sm text-sand space-y-1">
              <p><span className="text-spice">+</span> token-gating</p>
              <p><span className="text-spice">+</span> multi-chain</p>
              <p><span className="text-spice">+</span> conviction scoring</p>
              <p><span className="text-spice">+</span> 9-tier progression</p>
              <p><span className="text-spice">+</span> 10+ badges</p>
              <p><span className="text-spice">+</span> shadow mode</p>
              <p><span className="text-spice">+</span> analytics dashboard</p>
            </div>
            <div className="text-sand-dim text-xs mt-4 pt-3 border-t border-sand-dim/30">
              premium: $99/mo
            </div>
          </div>
          <div className="border border-sand-dim/30 p-4">
            <div className="text-sand-bright mb-3">COLLAB.LAND</div>
            <div className="text-sm text-sand space-y-1">
              <p><span className="text-sand-dim">+</span> token-gating</p>
              <p><span className="text-sand-dim">+</span> multi-chain (40+)</p>
              <p><span className="text-sand-dim">-</span> no conviction scoring</p>
              <p><span className="text-sand-dim">-</span> no tiered progression</p>
              <p><span className="text-sand-dim">-</span> no badge system</p>
              <p><span className="text-sand-dim">-</span> no coexistence mode</p>
              <p><span className="text-sand-dim">-</span> basic analytics</p>
            </div>
            <div className="text-sand-dim text-xs mt-4 pt-3 border-t border-sand-dim/30">
              standard: ~$49-99/mo | elite: $449/mo
            </div>
          </div>
        </div>
      </section>

      {/* Core Difference */}
      <section>
        <div className="text-sand-dim text-xs mb-4">// core_difference</div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-sand-dim/30 p-4 text-center">
            <div className="text-sand-dim text-xs mb-2">collab.land answers:</div>
            <div className="text-sand-bright">
              &quot;does this wallet hold our token?&quot;
            </div>
          </div>
          <div className="border border-spice/50 p-4 text-center">
            <div className="text-sand-dim text-xs mb-2">arrakis answers:</div>
            <div className="text-spice">
              &quot;does this person believe in our project?&quot;
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Comparison */}
      <section>
        <div className="text-sand-dim text-xs mb-4">// detailed_comparison</div>
        <div className="border border-sand-dim/30 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand-dim/30">
                <th className="text-left p-3 text-sand-dim">feature</th>
                <th className="text-center p-3 text-spice">arrakis</th>
                <th className="text-center p-3 text-sand-dim">collab.land</th>
              </tr>
            </thead>
            <tbody className="text-sand">
              <tr className="border-b border-sand-dim/10 bg-sand-dim/5">
                <td className="p-3 text-sand-bright" colSpan={3}>token-gating</td>
              </tr>
              <tr className="border-b border-sand-dim/10">
                <td className="p-3">erc20 balance check</td>
                <td className="p-3 text-center text-spice">✓</td>
                <td className="p-3 text-center text-sand-dim">✓</td>
              </tr>
              <tr className="border-b border-sand-dim/10">
                <td className="p-3">nft ownership</td>
                <td className="p-3 text-center text-spice">✓</td>
                <td className="p-3 text-center text-sand-dim">✓</td>
              </tr>
              <tr className="border-b border-sand-dim/10">
                <td className="p-3">multi-chain support</td>
                <td className="p-3 text-center text-spice">score service</td>
                <td className="p-3 text-center text-sand-dim">40+ chains</td>
              </tr>

              <tr className="border-b border-sand-dim/10 bg-sand-dim/5">
                <td className="p-3 text-sand-bright" colSpan={3}>engagement intelligence</td>
              </tr>
              <tr className="border-b border-sand-dim/10">
                <td className="p-3">conviction scoring</td>
                <td className="p-3 text-center text-spice">✓</td>
                <td className="p-3 text-center text-sand-dim">—</td>
              </tr>
              <tr className="border-b border-sand-dim/10">
                <td className="p-3">holding duration analysis</td>
                <td className="p-3 text-center text-spice">✓</td>
                <td className="p-3 text-center text-sand-dim">—</td>
              </tr>
              <tr className="border-b border-sand-dim/10">
                <td className="p-3">trading pattern detection</td>
                <td className="p-3 text-center text-spice">✓</td>
                <td className="p-3 text-center text-sand-dim">—</td>
              </tr>
              <tr className="border-b border-sand-dim/10">
                <td className="p-3">diamond hands identification</td>
                <td className="p-3 text-center text-spice">✓</td>
                <td className="p-3 text-center text-sand-dim">—</td>
              </tr>

              <tr className="border-b border-sand-dim/10 bg-sand-dim/5">
                <td className="p-3 text-sand-bright" colSpan={3}>progression system</td>
              </tr>
              <tr className="border-b border-sand-dim/10">
                <td className="p-3">tiered roles</td>
                <td className="p-3 text-center text-spice">9 tiers</td>
                <td className="p-3 text-center text-sand-dim">—</td>
              </tr>
              <tr className="border-b border-sand-dim/10">
                <td className="p-3">dynamic rank progression</td>
                <td className="p-3 text-center text-spice">✓</td>
                <td className="p-3 text-center text-sand-dim">—</td>
              </tr>
              <tr className="border-b border-sand-dim/10">
                <td className="p-3">badge gamification</td>
                <td className="p-3 text-center text-spice">10+ types</td>
                <td className="p-3 text-center text-sand-dim">—</td>
              </tr>

              <tr className="border-b border-sand-dim/10 bg-sand-dim/5">
                <td className="p-3 text-sand-bright" colSpan={3}>operations</td>
              </tr>
              <tr className="border-b border-sand-dim/10">
                <td className="p-3">self-service setup</td>
                <td className="p-3 text-center text-spice">15 min</td>
                <td className="p-3 text-center text-sand-dim">✓</td>
              </tr>
              <tr className="border-b border-sand-dim/10">
                <td className="p-3">balance refresh</td>
                <td className="p-3 text-center text-spice">6 hours</td>
                <td className="p-3 text-center text-sand-dim">24 hours</td>
              </tr>
              <tr className="border-b border-sand-dim/10">
                <td className="p-3">shadow/coexistence mode</td>
                <td className="p-3 text-center text-spice">✓</td>
                <td className="p-3 text-center text-sand-dim">—</td>
              </tr>

              <tr className="border-b border-sand-dim/10 bg-sand-dim/5">
                <td className="p-3 text-sand-bright" colSpan={3}>enterprise</td>
              </tr>
              <tr className="border-b border-sand-dim/10">
                <td className="p-3">row-level security</td>
                <td className="p-3 text-center text-spice">✓</td>
                <td className="p-3 text-center text-sand-dim">unknown</td>
              </tr>
              <tr className="border-b border-sand-dim/10">
                <td className="p-3">audit trail</td>
                <td className="p-3 text-center text-spice">✓</td>
                <td className="p-3 text-center text-sand-dim">partial</td>
              </tr>
              <tr className="border-b border-sand-dim/10">
                <td className="p-3">custom themes</td>
                <td className="p-3 text-center text-spice">✓</td>
                <td className="p-3 text-center text-sand-dim">—</td>
              </tr>
              <tr>
                <td className="p-3">white-label</td>
                <td className="p-3 text-center text-spice">✓</td>
                <td className="p-3 text-center text-sand-dim">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* What Collab.Land Does Well */}
      <section>
        <div className="text-sand-dim text-xs mb-4">// what_collabland_does_well</div>
        <div className="border border-sand-dim/30 p-4">
          <div className="text-sand-bright mb-3">market leader in access control</div>
          <p className="text-sand text-sm mb-4">
            collab.land pioneered token-gating. with 6.5+ million verified wallets and
            tens of thousands of communities, they&apos;ve proven the category.
          </p>
          <div className="grid md:grid-cols-2 gap-2 text-sm">
            <div className="text-sand"><span className="text-sand-dim">+</span> massive scale and track record</div>
            <div className="text-sand"><span className="text-sand-dim">+</span> 40+ chains supported</div>
            <div className="text-sand"><span className="text-sand-dim">+</span> first-mover trust</div>
            <div className="text-sand"><span className="text-sand-dim">+</span> well-documented apis</div>
          </div>
          <p className="text-sand-dim text-sm mt-4 pt-3 border-t border-sand-dim/30">
            if you only need binary access control (hold token → get role), collab.land works.
          </p>
        </div>
      </section>

      {/* What Arrakis Adds */}
      <section>
        <div className="text-sand-dim text-xs mb-4">// what_arrakis_adds</div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-sand-dim/30 p-4">
            <div className="text-spice mb-2">conviction_scoring</div>
            <p className="text-sand text-sm">
              we analyze on-chain behavior — holding duration, trading patterns,
              accumulation history — to identify your most committed members.
            </p>
            <p className="text-sand-dim text-xs mt-2">
              use case: weight your next airdrop by conviction, not just balance.
            </p>
          </div>
          <div className="border border-sand-dim/30 p-4">
            <div className="text-spice mb-2">9_tier_progression</div>
            <p className="text-sand text-sm">
              binary access (yes/no) is flat. arrakis creates a journey from outsider
              to naib council. your top 7 holders become visible leadership.
            </p>
            <p className="text-sand-dim text-xs mt-2">
              use case: create council-only channels for your most committed members.
            </p>
          </div>
          <div className="border border-sand-dim/30 p-4">
            <div className="text-spice mb-2">badge_gamification</div>
            <p className="text-sand text-sm">
              10+ badge types for tenure, achievements, and community contribution.
              create collector culture where long-term holding is recognized.
            </p>
            <p className="text-sand-dim text-xs mt-2">
              use case: award &quot;first wave&quot; badges to founding members automatically.
            </p>
          </div>
          <div className="border border-sand-dim/30 p-4">
            <div className="text-spice mb-2">shadow_mode</div>
            <p className="text-sand text-sm">
              already on collab.land? run arrakis in parallel. see your conviction
              data without changing anything. switch when you&apos;re confident.
            </p>
            <p className="text-sand-dim text-xs mt-2">
              use case: validate arrakis accuracy before migrating.
            </p>
          </div>
        </div>
      </section>

      {/* Migration Path */}
      <section>
        <div className="text-sand-dim text-xs mb-4">// migration_path</div>
        <pre className="text-sand text-xs overflow-x-auto whitespace-pre border border-sand-dim/30 p-4">
{`┌──────────────────────────────────────────────────────────────┐
│                      MIGRATION PATH                          │
├────────────────┬─────────────────────────────────────────────┤
│  STEP 1        │ shadow mode - observe without managing      │
│  STEP 2        │ validate - compare to your intuition        │
│  STEP 3        │ parallel - namespaced roles coexist         │
│  STEP 4        │ primary - promote arrakis, keep fallback    │
└────────────────┴─────────────────────────────────────────────┘

zero-risk migration: try before you switch.`}
        </pre>
      </section>

      {/* When to Choose */}
      <section>
        <div className="text-sand-dim text-xs mb-4">// when_to_choose</div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="border border-sand-dim/30 p-4">
            <div className="text-sand-bright text-sm mb-3">choose collab.land if:</div>
            <div className="text-sm text-sand space-y-1">
              <p><span className="text-sand-dim">-</span> you only need binary access control</p>
              <p><span className="text-sand-dim">-</span> scale and track record are primary</p>
              <p><span className="text-sand-dim">-</span> you don&apos;t need analytics/progression</p>
              <p><span className="text-sand-dim">-</span> you want the market standard</p>
            </div>
          </div>
          <div className="border border-spice/50 p-4">
            <div className="text-spice text-sm mb-3">choose arrakis if:</div>
            <div className="text-sm text-sand space-y-1">
              <p><span className="text-spice">+</span> you want to identify valuable members</p>
              <p><span className="text-spice">+</span> you&apos;re planning airdrops</p>
              <p><span className="text-spice">+</span> you want tiered progression</p>
              <p><span className="text-spice">+</span> you value analytics and insights</p>
              <p><span className="text-spice">+</span> you want to try alongside current setup</p>
            </div>
          </div>
          <div className="border border-sand-dim/30 p-4">
            <div className="text-sand-bright text-sm mb-3">use both if:</div>
            <div className="text-sm text-sand space-y-1">
              <p><span className="text-sand-dim">-</span> you want shadow mode evaluation</p>
              <p><span className="text-sand-dim">-</span> you need collab.land integrations</p>
              <p><span className="text-sand-dim">-</span> you want intelligence on top of access</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="text-sand-dim text-xs mb-4">// faq</div>
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-sand-bright">
              <span className="text-spice">Q:</span> we already use collab.land and it works fine
            </p>
            <p className="text-sand mt-1">
              <span className="text-sand-dim">A:</span> collab.land is great for access control.
              if that&apos;s all you need, stay with it. but when you need to know who your
              diamond hands are — for airdrops, governance, recognizing believers — that&apos;s
              where arrakis starts. shadow mode lets you see data without changing anything.
            </p>
          </div>
          <div>
            <p className="text-sand-bright">
              <span className="text-spice">Q:</span> collab.land has more chain support
            </p>
            <p className="text-sand mt-1">
              <span className="text-sand-dim">A:</span> true — 40+ chains vs our score service
              coverage. but chain count is commoditizing. what matters is intelligence: do
              you know who believes in your project? more chains don&apos;t tell you that.
            </p>
          </div>
          <div>
            <p className="text-sand-bright">
              <span className="text-spice">Q:</span> collab.land is the industry standard
            </p>
            <p className="text-sand mt-1">
              <span className="text-sand-dim">A:</span> they are, for access control. we&apos;re not
              trying to replace access control — we&apos;re adding an engagement layer on top.
              industry standards evolve as needs evolve.
            </p>
          </div>
          <div>
            <p className="text-sand-bright">
              <span className="text-spice">Q:</span> i don&apos;t want to switch
            </p>
            <p className="text-sand mt-1">
              <span className="text-sand-dim">A:</span> then don&apos;t. shadow mode runs alongside
              collab.land. zero changes to your current setup. see what conviction data
              reveals, decide later.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border border-spice/50 p-6 text-center">
        <p className="text-sand-bright text-lg mb-2">
          see what conviction data reveals about your community
        </p>
        <p className="text-sand-dim text-sm mb-6">
          run arrakis in shadow mode alongside collab.land. no changes to your current
          setup. see your diamond hands.
        </p>
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <Link
            href="https://discord.gg/thehoneyjar"
            className="text-spice hover:text-spice-bright"
          >
            [start shadow mode free]
          </Link>
          <Link href="/pricing" className="text-sand hover:text-sand-bright">
            [view pricing]
          </Link>
        </div>
        <p className="text-sand-dim text-xs mt-4">
          no credit card • works alongside collab.land • zero risk evaluation
        </p>
      </section>
    </div>
  );
}
