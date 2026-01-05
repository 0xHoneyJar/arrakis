'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Check,
  X,
  Minus,
  Shield,
  TrendingUp,
  Users,
  BarChart3,
  Clock,
  Layers,
  Award,
  Eye,
  Zap,
  RefreshCw,
  CheckCircle
} from 'lucide-react';

export default function VsCollabLandPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="section bg-gradient-to-b from-desert-900 to-desert-800 text-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-spice-500/20 text-spice-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
              Comparison
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Collab.Land gates the door. Arrakis creates the journey.
            </h1>
            <p className="text-xl md:text-2xl text-sand-300 mb-8 max-w-3xl mx-auto">
              Collab.Land is the industry standard for token-gating. But access control is just the beginning. Arrakis adds engagement intelligence — so you know who matters, not just who can enter.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/pricing" className="btn bg-spice-500 hover:bg-spice-600 text-white px-8 py-4 text-lg">
                Try Arrakis Free
              </Link>
              <a href="#comparison" className="btn bg-white/10 hover:bg-white/20 text-white border border-white/30 px-8 py-4 text-lg">
                See Full Comparison
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Comparison */}
      <section className="section bg-sand-50">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Arrakis */}
            <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-8 rounded-2xl border-2 border-spice-500">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-xl">A</span>
                </div>
                <h3 className="text-2xl font-bold text-desert-900">Arrakis</h3>
              </div>
              <ul className="space-y-3">
                {[
                  'Token-gating',
                  'Multi-chain',
                  'Conviction scoring',
                  '9-tier progression',
                  '10+ badges',
                  'Shadow mode',
                  'Analytics dashboard'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-spice-500" />
                    <span className="text-desert-800">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-6 border-t border-spice-200">
                <p className="text-desert-600">Premium: <span className="font-bold text-desert-900">$99/mo</span></p>
              </div>
            </div>

            {/* Collab.Land */}
            <div className="bg-white p-8 rounded-2xl border border-sand-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-sand-200 rounded-xl flex items-center justify-center">
                  <span className="text-desert-600 font-bold text-xl">C</span>
                </div>
                <h3 className="text-2xl font-bold text-desert-900">Collab.Land</h3>
              </div>
              <ul className="space-y-3">
                {[
                  { text: 'Token-gating', has: true },
                  { text: 'Multi-chain (40+)', has: true },
                  { text: 'No conviction scoring', has: false },
                  { text: 'No tiered progression', has: false },
                  { text: 'No badge system', has: false },
                  { text: 'No coexistence mode', has: false },
                  { text: 'Basic analytics', has: false }
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    {item.has ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Minus className="w-5 h-5 text-sand-400" />
                    )}
                    <span className={item.has ? 'text-desert-800' : 'text-desert-400'}>{item.text}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-6 border-t border-sand-200">
                <p className="text-desert-600">Standard: <span className="font-bold text-desert-900">~$49-99/mo</span></p>
                <p className="text-desert-600">Elite: <span className="font-bold text-desert-900">$449/mo</span></p>
              </div>
            </div>
          </div>

          {/* Core Difference */}
          <div className="max-w-3xl mx-auto mt-16 text-center">
            <h3 className="text-2xl font-bold text-desert-900 mb-6">The Core Difference</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-sand-200">
                <p className="text-desert-600 mb-2">Collab.Land answers:</p>
                <p className="text-xl font-bold text-desert-900">"Does this wallet hold our token?"</p>
              </div>
              <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-6 rounded-xl border border-spice-200">
                <p className="text-desert-600 mb-2">Arrakis answers:</p>
                <p className="text-xl font-bold text-spice-600">"Does this person believe in our project?"</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Comparison Table */}
      <section id="comparison" className="section">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-4">
              Detailed Feature Comparison
            </h2>
          </div>

          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-sand-200">
                  <th className="text-left py-4 px-4 text-desert-600 font-medium">Feature</th>
                  <th className="text-center py-4 px-4 text-spice-600 font-bold">Arrakis</th>
                  <th className="text-center py-4 px-4 text-desert-600 font-bold">Collab.Land</th>
                </tr>
              </thead>
              <tbody>
                {/* Token-Gating Section */}
                <tr className="bg-sand-50">
                  <td colSpan={3} className="py-3 px-4 font-bold text-desert-900">Token-Gating</td>
                </tr>
                {[
                  { feature: 'ERC20 balance check', arrakis: true, collab: true },
                  { feature: 'NFT ownership', arrakis: true, collab: true },
                  { feature: 'Multi-chain support', arrakis: 'Score Service', collab: '40+ chains' },
                  { feature: 'Multi-wallet per user', arrakis: true, collab: true }
                ].map((row, i) => (
                  <tr key={i} className="border-b border-sand-100">
                    <td className="py-3 px-4 text-desert-700">{row.feature}</td>
                    <td className="py-3 px-4 text-center">
                      {row.arrakis === true ? (
                        <Check className="w-5 h-5 text-spice-500 mx-auto" />
                      ) : (
                        <span className="text-spice-600 font-medium">{row.arrakis}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.collab === true ? (
                        <Check className="w-5 h-5 text-green-500 mx-auto" />
                      ) : row.collab === false ? (
                        <Minus className="w-5 h-5 text-sand-400 mx-auto" />
                      ) : (
                        <span className="text-desert-600">{row.collab}</span>
                      )}
                    </td>
                  </tr>
                ))}

                {/* Engagement Intelligence */}
                <tr className="bg-sand-50">
                  <td colSpan={3} className="py-3 px-4 font-bold text-desert-900">Engagement Intelligence</td>
                </tr>
                {[
                  { feature: 'Conviction scoring', arrakis: true, collab: false },
                  { feature: 'Holding duration analysis', arrakis: true, collab: false },
                  { feature: 'Trading pattern detection', arrakis: true, collab: false },
                  { feature: 'Diamond hands identification', arrakis: true, collab: false }
                ].map((row, i) => (
                  <tr key={i} className="border-b border-sand-100">
                    <td className="py-3 px-4 text-desert-700">{row.feature}</td>
                    <td className="py-3 px-4 text-center">
                      <Check className="w-5 h-5 text-spice-500 mx-auto" />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Minus className="w-5 h-5 text-sand-400 mx-auto" />
                    </td>
                  </tr>
                ))}

                {/* Progression System */}
                <tr className="bg-sand-50">
                  <td colSpan={3} className="py-3 px-4 font-bold text-desert-900">Progression System</td>
                </tr>
                {[
                  { feature: 'Tiered roles', arrakis: '9 tiers', collab: false },
                  { feature: 'Dynamic rank progression', arrakis: true, collab: false },
                  { feature: 'Badge gamification', arrakis: '10+ types', collab: false },
                  { feature: 'Badge lineage tracking', arrakis: true, collab: false }
                ].map((row, i) => (
                  <tr key={i} className="border-b border-sand-100">
                    <td className="py-3 px-4 text-desert-700">{row.feature}</td>
                    <td className="py-3 px-4 text-center">
                      {row.arrakis === true ? (
                        <Check className="w-5 h-5 text-spice-500 mx-auto" />
                      ) : (
                        <span className="text-spice-600 font-medium">{row.arrakis}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Minus className="w-5 h-5 text-sand-400 mx-auto" />
                    </td>
                  </tr>
                ))}

                {/* Operations */}
                <tr className="bg-sand-50">
                  <td colSpan={3} className="py-3 px-4 font-bold text-desert-900">Operations</td>
                </tr>
                {[
                  { feature: 'Self-service setup', arrakis: '15 min', collab: true },
                  { feature: 'Balance refresh', arrakis: '6 hours', collab: '24 hours' },
                  { feature: 'Shadow/coexistence mode', arrakis: true, collab: false }
                ].map((row, i) => (
                  <tr key={i} className="border-b border-sand-100">
                    <td className="py-3 px-4 text-desert-700">{row.feature}</td>
                    <td className="py-3 px-4 text-center">
                      {row.arrakis === true ? (
                        <Check className="w-5 h-5 text-spice-500 mx-auto" />
                      ) : (
                        <span className="text-spice-600 font-medium">{row.arrakis}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.collab === true ? (
                        <Check className="w-5 h-5 text-green-500 mx-auto" />
                      ) : row.collab === false ? (
                        <Minus className="w-5 h-5 text-sand-400 mx-auto" />
                      ) : (
                        <span className="text-desert-600">{row.collab}</span>
                      )}
                    </td>
                  </tr>
                ))}

                {/* Enterprise */}
                <tr className="bg-sand-50">
                  <td colSpan={3} className="py-3 px-4 font-bold text-desert-900">Enterprise</td>
                </tr>
                {[
                  { feature: 'Row-level security', arrakis: true, collab: 'Unknown' },
                  { feature: 'Audit trail', arrakis: true, collab: 'Partial' },
                  { feature: 'Custom themes', arrakis: true, collab: false },
                  { feature: 'White-label', arrakis: true, collab: false }
                ].map((row, i) => (
                  <tr key={i} className="border-b border-sand-100">
                    <td className="py-3 px-4 text-desert-700">{row.feature}</td>
                    <td className="py-3 px-4 text-center">
                      <Check className="w-5 h-5 text-spice-500 mx-auto" />
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.collab === true ? (
                        <Check className="w-5 h-5 text-green-500 mx-auto" />
                      ) : row.collab === false ? (
                        <Minus className="w-5 h-5 text-sand-400 mx-auto" />
                      ) : (
                        <span className="text-desert-500 text-sm">{row.collab}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* What Collab.Land Does Well */}
      <section className="section bg-sand-50">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-8 text-center">
              What Collab.Land Does Well
            </h2>

            <div className="bg-white p-8 rounded-2xl border border-sand-200 mb-8">
              <h3 className="text-xl font-bold text-desert-900 mb-4">Market Leader in Access Control</h3>
              <p className="text-desert-600 mb-6">
                Collab.Land pioneered token-gating. With 6.5+ million verified wallets and tens of thousands of communities, they've proven the category.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  'Massive scale and track record',
                  '40+ chains supported',
                  'First-mover trust',
                  'Well-documented APIs'
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="text-desert-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-sand-100 to-sand-50 p-6 rounded-xl border border-sand-200 text-center">
              <p className="text-desert-700">
                <strong>If you only need binary access control</strong> (hold token &rarr; get role), Collab.Land works.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What Arrakis Adds */}
      <section className="section">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-4">
              What Arrakis Adds
            </h2>
            <p className="text-xl text-desert-600">
              Collab.Land tells you who holds your token. Arrakis tells you who <em>believes</em> in your project.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-8 rounded-2xl border border-spice-200">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Conviction Scoring</h3>
              <p className="text-desert-600 mb-4">
                We analyze on-chain behavior — holding duration, trading patterns, accumulation history — to identify your most committed members. Your 2-year diamond hands are different from yesterday's buyers.
              </p>
              <div className="bg-white/50 rounded-lg p-3 border border-spice-100">
                <p className="text-sm text-desert-700">
                  <strong>Use case:</strong> Weight your next airdrop by conviction, not just balance.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-8 rounded-2xl border border-spice-200">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mb-4">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">9-Tier Progression</h3>
              <p className="text-desert-600 mb-4">
                Binary access (yes/no) is flat. Arrakis creates a journey from Outsider to Naib council. Your top 7 holders become your visible leadership. Status drives engagement.
              </p>
              <div className="bg-white/50 rounded-lg p-3 border border-spice-100">
                <p className="text-sm text-desert-700">
                  <strong>Use case:</strong> Create council-only channels for your most committed members.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-8 rounded-2xl border border-spice-200">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mb-4">
                <Award className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Badge Gamification</h3>
              <p className="text-desert-600 mb-4">
                10+ badge types for tenure, achievements, and community contribution. Create collector culture where long-term holding is recognized.
              </p>
              <div className="bg-white/50 rounded-lg p-3 border border-spice-100">
                <p className="text-sm text-desert-700">
                  <strong>Use case:</strong> Award "First Wave" badges to founding members automatically.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-8 rounded-2xl border border-spice-200">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mb-4">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Shadow Mode</h3>
              <p className="text-desert-600 mb-4">
                Already on Collab.Land? Run Arrakis in parallel. See your conviction data without changing anything. Switch when you're confident.
              </p>
              <div className="bg-white/50 rounded-lg p-3 border border-spice-100">
                <p className="text-sm text-desert-700">
                  <strong>Use case:</strong> Validate Arrakis accuracy before migrating.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Migration Path */}
      <section className="section bg-desert-900 text-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                How to Switch (or Add) Arrakis
              </h2>
              <p className="text-xl text-sand-300">
                You don't have to choose one or the other. Arrakis is designed to work alongside Collab.Land.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  step: 1,
                  title: 'Shadow Mode',
                  desc: 'Install Arrakis in shadow mode. It observes your community without managing roles. See conviction data for all your holders.'
                },
                {
                  step: 2,
                  title: 'Validate',
                  desc: 'Compare our conviction scoring to your intuition. Do we correctly identify your diamond hands? Your flippers?'
                },
                {
                  step: 3,
                  title: 'Parallel Mode',
                  desc: 'Run Arrakis roles alongside Collab.Land. Namespaced roles coexist with existing setup.'
                },
                {
                  step: 4,
                  title: 'Primary Mode',
                  desc: 'When confident, promote Arrakis to primary. Keep Collab.Land as fallback or remove entirely.'
                }
              ].map((item, i) => (
                <div key={i} className="bg-white/5 p-6 rounded-xl border border-white/10">
                  <div className="w-10 h-10 bg-spice-500 rounded-lg flex items-center justify-center text-white font-bold mb-4">
                    {item.step}
                  </div>
                  <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                  <p className="text-sand-300 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <p className="text-spice-400 font-bold text-lg">
                Zero-risk migration: Try before you switch.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* When to Choose */}
      <section className="section bg-sand-50">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-4">
              When to Choose Each
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-2xl border border-sand-200">
              <h3 className="text-xl font-bold text-desert-900 mb-6">Choose Collab.Land If:</h3>
              <ul className="space-y-3">
                {[
                  'You only need binary access control',
                  'Scale and track record are primary concerns',
                  "You don't need analytics or progression",
                  'You want the market standard'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-desert-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-8 rounded-2xl border-2 border-spice-500">
              <h3 className="text-xl font-bold text-desert-900 mb-6">Choose Arrakis If:</h3>
              <ul className="space-y-3">
                {[
                  'You want to identify your most valuable members',
                  "You're planning airdrops and need conviction data",
                  'You want tiered progression to drive engagement',
                  'You value analytics and holder insights',
                  'You want to try alongside your current setup'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-spice-500 flex-shrink-0 mt-0.5" />
                    <span className="text-desert-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-sand-200">
              <h3 className="text-xl font-bold text-desert-900 mb-6">Use Both If:</h3>
              <ul className="space-y-3">
                {[
                  'You want shadow mode evaluation before committing',
                  "You need Collab.Land's specific integrations",
                  'You want engagement intelligence on top of access control'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-desert-500 flex-shrink-0 mt-0.5" />
                    <span className="text-desert-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ / Objections */}
      <section className="section">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-4">
              Common Questions
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            {[
              {
                q: '"We already use Collab.Land and it works fine"',
                a: "Collab.Land is great for access control. If that's all you need, stay with it. But when you need to know who your diamond hands are — for airdrops, for governance, for recognizing your true believers — that's where Arrakis starts. Shadow mode lets you see the data without changing anything."
              },
              {
                q: '"Collab.Land has more chain support"',
                a: "True — 40+ chains vs our Score Service coverage. But chain count is commoditizing. What matters is intelligence: do you know who believes in your project? More chains don't tell you that."
              },
              {
                q: '"Collab.Land is the industry standard"',
                a: "They are, for access control. We're not trying to replace access control — we're adding an engagement layer on top. Industry standards evolve as needs evolve."
              },
              {
                q: '"I don\'t want to switch"',
                a: "Then don't. Shadow mode runs alongside Collab.Land. Zero changes to your current setup. See what conviction data reveals, decide later."
              }
            ].map((item, i) => (
              <div key={i} className="bg-sand-50 p-6 rounded-xl border border-sand-200">
                <h3 className="font-bold text-desert-900 mb-3">{item.q}</h3>
                <p className="text-desert-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section bg-gradient-to-b from-desert-900 to-desert-950 text-white">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              See what conviction data reveals about your community
            </h2>
            <p className="text-xl text-sand-300 mb-8">
              Run Arrakis in shadow mode alongside Collab.Land. No changes to your current setup. See your diamond hands.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/pricing" className="btn bg-spice-500 hover:bg-spice-600 text-white px-8 py-4 text-lg">
                Start Shadow Mode Free
                <ArrowRight className="ml-2 w-5 h-5 inline" />
              </Link>
              <Link href="/pricing" className="btn bg-white/10 hover:bg-white/20 text-white border border-white/30 px-8 py-4 text-lg">
                Schedule Demo
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-6">
              {[
                'No credit card required',
                'Works alongside Collab.Land',
                'Zero risk evaluation'
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-spice-400" />
                  <span className="text-sand-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
