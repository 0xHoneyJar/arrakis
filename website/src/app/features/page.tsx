import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'features // ARRAKIS',
  description:
    'Conviction scoring, 9-tier progression, badge gamification, and zero-risk adoption for Web3 communities.',
};

export default function FeaturesPage() {
  return (
    <div className="space-y-16">
      {/* Header */}
      <section>
        <div className="text-sand-dim text-xs mb-2">// features</div>
        <h1 className="text-2xl text-sand-bright">
          engagement intelligence for web3
        </h1>
        <p className="text-sand mt-2">
          go beyond token-gating. identify, reward, engage.
        </p>
      </section>

      {/* Feature Index */}
      <section>
        <div className="text-sand-dim text-xs mb-4">// index</div>
        <div className="space-y-1 text-sm">
          <a href="#conviction" className="block text-sand hover:text-sand-bright">
            <span className="text-spice">&gt;</span> conviction_scoring
          </a>
          <a href="#tiers" className="block text-sand hover:text-sand-bright">
            <span className="text-spice">&gt;</span> tier_progression
          </a>
          <a href="#badges" className="block text-sand hover:text-sand-bright">
            <span className="text-spice">&gt;</span> badge_system
          </a>
          <a href="#shadow" className="block text-sand hover:text-sand-bright">
            <span className="text-spice">&gt;</span> shadow_mode
          </a>
          <a href="#chains" className="block text-sand hover:text-sand-bright">
            <span className="text-spice">&gt;</span> multi_chain
          </a>
          <a href="#setup" className="block text-sand hover:text-sand-bright">
            <span className="text-spice">&gt;</span> self_service_setup
          </a>
          <a href="#enterprise" className="block text-sand hover:text-sand-bright">
            <span className="text-spice">&gt;</span> enterprise_security
          </a>
        </div>
      </section>

      {/* Conviction Scoring */}
      <section id="conviction">
        <div className="text-sand-dim text-xs mb-4">// conviction_scoring [premium]</div>
        <div className="border border-sand-dim/30 p-4">
          <h2 className="text-spice text-lg mb-4">know who your diamond hands are</h2>
          <p className="text-sand mb-6">
            token balance tells you who holds. conviction scoring tells you who believes.
            we analyze on-chain behavior to identify your most valuable members.
          </p>

          <div className="space-y-4 text-sm">
            <div>
              <span className="text-sand-bright">holding_duration</span>
              <p className="text-sand-dim mt-1">
                how long have they held? 2 years vs yesterday = different believers.
              </p>
            </div>
            <div>
              <span className="text-sand-bright">trading_patterns</span>
              <p className="text-sand-dim mt-1">
                accumulating or distributing? diamond hands add during dips.
              </p>
            </div>
            <div>
              <span className="text-sand-bright">on_chain_activity</span>
              <p className="text-sand-dim mt-1">
                governance participation, protocol usage, ecosystem engagement.
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-sand-dim/30 pt-4">
            <div className="text-sand-dim text-xs mb-2">// use-cases</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-spice">airdrops</span> - distribute to believers, not farmers</div>
              <div><span className="text-spice">governance</span> - weight votes by conviction</div>
              <div><span className="text-spice">tiered-access</span> - exclusive channels for diamond hands</div>
              <div><span className="text-spice">recognition</span> - surface committed members</div>
            </div>
          </div>
        </div>
      </section>

      {/* Tier Progression */}
      <section id="tiers">
        <div className="text-sand-dim text-xs mb-4">// tier_progression</div>
        <div className="border border-sand-dim/30 p-4">
          <h2 className="text-spice text-lg mb-4">9 tiers from outsider to naib</h2>
          <p className="text-sand mb-6">
            create a progression journey. rewards through recognition, not just access.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-sand-dim text-xs mb-2">// basictheme [free]</div>
              <pre className="text-sand text-xs">
{`┌────────────────────┐
│  GOLD    - top     │
│  SILVER  - mid     │
│  BRONZE  - entry   │
└────────────────────┘`}
              </pre>
            </div>

            <div>
              <div className="text-sand-dim text-xs mb-2">// sietchtheme [premium]</div>
              <pre className="text-sand text-xs">
{`┌────────────────────────────┐
│  NAIB          1-7    gold │
│  FEDAYKIN_ELT  8-15   tan  │
│  FEDAYKIN      16-30  tan  │
│  FREMEN        31-45  brown│
│  WANDERER      46-55  dark │
│  INITIATE      56-62  olive│
│  ASPIRANT      63-66  olive│
│  OBSERVER      67-69  gray │
│  OUTSIDER      70+    gray │
└────────────────────────────┘`}
              </pre>
            </div>
          </div>

          <div className="mt-6 text-sm text-sand-dim">
            progression: auto-rank → role assign → dynamic updates (6h) → channel access
          </div>
        </div>
      </section>

      {/* Badge System */}
      <section id="badges">
        <div className="text-sand-dim text-xs mb-4">// badge_system</div>
        <div className="border border-sand-dim/30 p-4">
          <h2 className="text-spice text-lg mb-4">gamify engagement with 10+ badges</h2>

          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <div className="text-sand-bright mb-2">tenure</div>
              <div className="space-y-1 text-sand">
                <p>* first_wave - joined month 1</p>
                <p>* veteran - 6+ months</p>
                <p>* diamond_hands - 1+ year holding</p>
              </div>
            </div>

            <div>
              <div className="text-sand-bright mb-2">achievement</div>
              <div className="space-y-1 text-sand">
                <p>* council - reached naib tier</p>
                <p>* accumulator - increased 3x</p>
                <p>* voter - governance participation</p>
              </div>
            </div>

            <div>
              <div className="text-sand-bright mb-2">activity</div>
              <div className="space-y-1 text-sand">
                <p>* streak_master - 30+ days active</p>
                <p>* engaged - high activity score</p>
              </div>
            </div>

            <div>
              <div className="text-sand-bright mb-2">community</div>
              <div className="space-y-1 text-sand">
                <p>* water_sharer - awarded by member</p>
                <p>* contributor - recognized contribution</p>
              </div>
            </div>
          </div>

          <div className="mt-6 text-spice text-sm">
            badge_lineage [premium]: members award badges to others, creating chains
          </div>
        </div>
      </section>

      {/* Shadow Mode */}
      <section id="shadow">
        <div className="text-sand-dim text-xs mb-4">// shadow_mode [zero-risk]</div>
        <div className="border border-sand-dim/30 p-4">
          <h2 className="text-spice text-lg mb-4">try alongside your current setup</h2>
          <p className="text-sand mb-6">
            already using collab.land or guild.xyz? run arrakis in parallel.
            see conviction data, validate accuracy, switch when ready.
          </p>

          <pre className="text-sand text-xs">
{`┌────────────────────────────────────────────────────────┐
│                    MIGRATION PATH                      │
├────────────────────────────────────────────────────────┤
│  SHADOW   → observe only, see data      [zero risk]   │
│  PARALLEL → namespaced roles alongside  [low risk]    │
│  PRIMARY  → arrakis becomes authority   [medium]      │
│  EXCLUSIVE→ full takeover               [full switch] │
└────────────────────────────────────────────────────────┘`}
          </pre>

          <div className="mt-4 text-sm text-sand">
            <span className="text-spice">step 1:</span> install, observe data{' '}
            <span className="text-spice">step 2:</span> validate accuracy{' '}
            <span className="text-spice">step 3:</span> test parallel{' '}
            <span className="text-spice">step 4:</span> switch when confident
          </div>
        </div>
      </section>

      {/* Multi-Chain */}
      <section id="chains">
        <div className="text-sand-dim text-xs mb-4">// multi_chain</div>
        <div className="border border-sand-dim/30 p-4">
          <h2 className="text-spice text-lg mb-4">one community, many chains</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-4">
            {['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'avalanche', 'bnb'].map(
              (chain) => (
                <div key={chain} className="text-sand">
                  <span className="text-spice">+</span> {chain}
                </div>
              )
            )}
          </div>

          <div className="text-sand-dim text-sm">
            aggregated balances • unified scoring • chain-specific roles if needed
          </div>
        </div>
      </section>

      {/* Self-Service Setup */}
      <section id="setup">
        <div className="text-sand-dim text-xs mb-4">// self_service_setup</div>
        <div className="border border-sand-dim/30 p-4">
          <h2 className="text-spice text-lg mb-4">set up in 15 minutes. no code required.</h2>

          <div className="text-sm space-y-1 text-sand">
            <p><span className="text-sand-dim">[1]</span> welcome - name community, choose theme</p>
            <p><span className="text-sand-dim">[2]</span> select_chain - choose blockchain(s)</p>
            <p><span className="text-sand-dim">[3]</span> configure_asset - enter contract address</p>
            <p><span className="text-sand-dim">[4]</span> set_rules - min balance, thresholds</p>
            <p><span className="text-sand-dim">[5]</span> map_roles - discord roles to tiers</p>
            <p><span className="text-sand-dim">[6]</span> channels - template or custom</p>
            <p><span className="text-sand-dim">[7]</span> review - preview configuration</p>
            <p><span className="text-sand-dim">[8]</span> deploy - one click activation</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-sand-dim">
            <div>setup_time: ~15 min</div>
            <div>code_required: none</div>
            <div>permissions: manage_roles, manage_channels</div>
            <div>session_recovery: /resume</div>
          </div>
        </div>
      </section>

      {/* Enterprise Security */}
      <section id="enterprise">
        <div className="text-sand-dim text-xs mb-4">// enterprise_security [enterprise]</div>
        <div className="border border-sand-dim/30 p-4">
          <h2 className="text-spice text-lg mb-4">enterprise-grade infrastructure</h2>

          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <div className="text-sand-bright mb-2">security</div>
              <div className="space-y-1 text-sand">
                <p>* row-level security (rls) - complete tenant isolation</p>
                <p>* audit trail - full logging of admin actions</p>
                <p>* two-tier arch - 99.9% uptime target</p>
              </div>
            </div>

            <div>
              <div className="text-sand-bright mb-2">infrastructure</div>
              <div className="space-y-1 text-sand">
                <p>* database: postgresql 15 with rls</p>
                <p>* cache: redis 7</p>
                <p>* secrets: hcp vault</p>
                <p>* cloud: aws eks</p>
              </div>
            </div>

            <div>
              <div className="text-sand-bright mb-2">performance</div>
              <div className="space-y-1 text-sand">
                <p>* basic check: &lt;100ms</p>
                <p>* advanced check: &lt;500ms</p>
                <p>* wizard step: &lt;3s</p>
                <p>* uptime sla: 99.9%</p>
              </div>
            </div>

            <div>
              <div className="text-sand-bright mb-2">enterprise-only</div>
              <div className="space-y-1 text-sand">
                <p>* custom themes</p>
                <p>* white-label bot</p>
                <p>* full api access</p>
                <p>* dedicated slack + 4h sla</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section>
        <div className="text-sand-dim text-xs mb-4">// platform_support</div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-sand-dim/30 p-4">
            <div className="text-spice mb-2">discord</div>
            <div className="text-sm text-sand space-y-1">
              <p>+ role management</p>
              <p>+ channel gating</p>
              <p>+ modal wizard</p>
              <p>+ slash commands</p>
              <p>+ event notifications</p>
            </div>
          </div>
          <div className="border border-sand-dim/30 p-4">
            <div className="text-spice mb-2">telegram</div>
            <div className="text-sm text-sand space-y-1">
              <p>+ group access control</p>
              <p>+ balance verification</p>
              <p>+ basic tier display</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border border-spice/50 p-6 text-center">
        <p className="text-sand-bright text-lg mb-2">ready to go beyond token-gating?</p>
        <p className="text-sand-dim text-sm mb-6">
          start free. see conviction data in shadow mode. upgrade when ready.
        </p>
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <Link
            href="https://discord.gg/thehoneyjar"
            className="text-spice hover:text-spice-bright"
          >
            [start free]
          </Link>
          <Link href="/pricing" className="text-sand hover:text-sand-bright">
            [view pricing]
          </Link>
        </div>
      </section>
    </div>
  );
}
