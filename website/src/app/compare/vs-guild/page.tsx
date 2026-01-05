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
  CheckCircle,
  MessageCircle,
  DollarSign,
  Target
} from 'lucide-react';

export default function VsGuildPage() {
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
              Guild.xyz manages access. Arrakis creates value.
            </h1>
            <p className="text-xl md:text-2xl text-sand-300 mb-8 max-w-3xl mx-auto">
              Guild.xyz offers free token-gating with impressive chain support. But when you need to know <em>who matters</em> in your community — not just who can enter — that's where Arrakis begins.
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
                  'Analytics dashboard',
                  'Telegram support'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-spice-500" />
                    <span className="text-desert-800">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-6 border-t border-spice-200">
                <p className="text-desert-600">Free + Premium: <span className="font-bold text-desert-900">$99/mo</span></p>
              </div>
            </div>

            {/* Guild.xyz */}
            <div className="bg-white p-8 rounded-2xl border border-sand-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-sand-200 rounded-xl flex items-center justify-center">
                  <span className="text-desert-600 font-bold text-xl">G</span>
                </div>
                <h3 className="text-2xl font-bold text-desert-900">Guild.xyz</h3>
              </div>
              <ul className="space-y-3">
                {[
                  { text: 'Token-gating', has: true },
                  { text: 'Multi-chain (60+ EVM)', has: true },
                  { text: 'No conviction scoring', has: false },
                  { text: 'Basic requirements', has: 'partial' },
                  { text: 'Points system', has: 'partial' },
                  { text: 'No coexistence mode', has: false },
                  { text: 'Basic analytics', has: 'partial' },
                  { text: 'No Telegram', has: false }
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    {item.has === true ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : item.has === 'partial' ? (
                      <Minus className="w-5 h-5 text-yellow-500" />
                    ) : (
                      <Minus className="w-5 h-5 text-sand-400" />
                    )}
                    <span className={item.has === true ? 'text-desert-800' : item.has === 'partial' ? 'text-desert-600' : 'text-desert-400'}>{item.text}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-6 border-t border-sand-200">
                <p className="text-desert-600">Price: <span className="font-bold text-green-600">Free (all features)</span></p>
              </div>
            </div>
          </div>

          {/* Core Difference */}
          <div className="max-w-3xl mx-auto mt-16 text-center">
            <h3 className="text-2xl font-bold text-desert-900 mb-6">The Core Difference</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-sand-200">
                <p className="text-desert-600 mb-2">Guild.xyz answers:</p>
                <p className="text-xl font-bold text-desert-900">"Does this wallet meet our requirements?"</p>
              </div>
              <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-6 rounded-xl border border-spice-200">
                <p className="text-desert-600 mb-2">Arrakis answers:</p>
                <p className="text-xl font-bold text-spice-600">"How committed is this person to our community?"</p>
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
                  <th className="text-center py-4 px-4 text-desert-600 font-bold">Guild.xyz</th>
                </tr>
              </thead>
              <tbody>
                {/* Token-Gating Section */}
                <tr className="bg-sand-50">
                  <td colSpan={3} className="py-3 px-4 font-bold text-desert-900">Token-Gating</td>
                </tr>
                {[
                  { feature: 'ERC20 balance check', arrakis: true, guild: true },
                  { feature: 'NFT ownership', arrakis: true, guild: true },
                  { feature: 'Multi-chain support', arrakis: 'Score Service', guild: '60+ EVM' },
                  { feature: 'Multi-wallet per user', arrakis: true, guild: true }
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
                      {row.guild === true ? (
                        <Check className="w-5 h-5 text-green-500 mx-auto" />
                      ) : row.guild === false ? (
                        <Minus className="w-5 h-5 text-sand-400 mx-auto" />
                      ) : (
                        <span className="text-desert-600">{row.guild}</span>
                      )}
                    </td>
                  </tr>
                ))}

                {/* Requirements Engine */}
                <tr className="bg-sand-50">
                  <td colSpan={3} className="py-3 px-4 font-bold text-desert-900">Requirements Engine</td>
                </tr>
                {[
                  { feature: 'On-chain requirements', arrakis: true, guild: true },
                  { feature: 'Off-chain requirements (GitHub, Twitter)', arrakis: false, guild: true },
                  { feature: 'Custom logic', arrakis: false, guild: true }
                ].map((row, i) => (
                  <tr key={i} className="border-b border-sand-100">
                    <td className="py-3 px-4 text-desert-700">{row.feature}</td>
                    <td className="py-3 px-4 text-center">
                      {row.arrakis === true ? (
                        <Check className="w-5 h-5 text-spice-500 mx-auto" />
                      ) : (
                        <Minus className="w-5 h-5 text-sand-400 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.guild === true ? (
                        <Check className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <Minus className="w-5 h-5 text-sand-400 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}

                {/* Engagement Intelligence */}
                <tr className="bg-sand-50">
                  <td colSpan={3} className="py-3 px-4 font-bold text-desert-900">Engagement Intelligence</td>
                </tr>
                {[
                  { feature: 'Conviction scoring', arrakis: true, guild: false },
                  { feature: 'Holding duration analysis', arrakis: true, guild: false },
                  { feature: 'Diamond hands identification', arrakis: true, guild: false }
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
                  { feature: 'Tiered roles', arrakis: '9 tiers', guild: 'Requirements-based' },
                  { feature: 'Dynamic rank progression', arrakis: true, guild: false },
                  { feature: 'Badge gamification', arrakis: '10+ types', guild: 'Points' },
                  { feature: 'Badge lineage', arrakis: true, guild: false }
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
                      {row.guild === true ? (
                        <Check className="w-5 h-5 text-green-500 mx-auto" />
                      ) : row.guild === false ? (
                        <Minus className="w-5 h-5 text-sand-400 mx-auto" />
                      ) : (
                        <span className="text-desert-500 text-sm">{row.guild}</span>
                      )}
                    </td>
                  </tr>
                ))}

                {/* Platforms */}
                <tr className="bg-sand-50">
                  <td colSpan={3} className="py-3 px-4 font-bold text-desert-900">Platforms</td>
                </tr>
                {[
                  { feature: 'Discord', arrakis: true, guild: true },
                  { feature: 'Telegram', arrakis: true, guild: false },
                  { feature: 'Other (GitHub, Google)', arrakis: false, guild: true }
                ].map((row, i) => (
                  <tr key={i} className="border-b border-sand-100">
                    <td className="py-3 px-4 text-desert-700">{row.feature}</td>
                    <td className="py-3 px-4 text-center">
                      {row.arrakis === true ? (
                        <Check className="w-5 h-5 text-spice-500 mx-auto" />
                      ) : (
                        <Minus className="w-5 h-5 text-sand-400 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.guild === true ? (
                        <Check className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <Minus className="w-5 h-5 text-sand-400 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}

                {/* Pricing */}
                <tr className="bg-sand-50">
                  <td colSpan={3} className="py-3 px-4 font-bold text-desert-900">Pricing</td>
                </tr>
                {[
                  { feature: 'Free tier', arrakis: true as boolean | string, guild: 'All features free' },
                  { feature: 'Premium features', arrakis: '$99/mo' as boolean | string, guild: 'Free' }
                ].map((row, i) => (
                  <tr key={i} className="border-b border-sand-100">
                    <td className="py-3 px-4 text-desert-700">{row.feature}</td>
                    <td className="py-3 px-4 text-center">
                      {row.arrakis === true ? (
                        <Check className="w-5 h-5 text-spice-500 mx-auto" />
                      ) : (
                        <span className="text-spice-600 font-medium">{String(row.arrakis)}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-green-600 font-medium">{row.guild}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* What Guild.xyz Does Well */}
      <section className="section bg-sand-50">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-8 text-center">
              What Guild.xyz Does Well
            </h2>

            <div className="bg-white p-8 rounded-2xl border border-sand-200 mb-8">
              <h3 className="text-xl font-bold text-desert-900 mb-4">Free and Flexible Access Management</h3>
              <p className="text-desert-600 mb-6">
                Guild.xyz offers a generous free tier with impressive flexibility. Their requirements engine supports complex logic across on-chain and off-chain conditions.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  'Completely free (all features)',
                  '60+ EVM chains',
                  'Flexible requirements (on-chain + off-chain)',
                  'Clean UX/UI',
                  'Multi-platform (GitHub, Google Workspace)'
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
                <strong>If you need flexible access management</strong> with complex requirements logic, Guild.xyz is powerful.
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
              From Access Management to Engagement Intelligence
            </h2>
            <p className="text-xl text-desert-600">
              Guild.xyz tells you who <em>can</em> access. Arrakis tells you who <em>matters</em>.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-8 rounded-2xl border border-spice-200">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Conviction Scoring</h3>
              <p className="text-desert-600 mb-4">
                Guild.xyz checks if requirements are met right now. Arrakis analyzes behavior over time — holding duration, trading patterns, accumulation — to identify who truly believes in your project.
              </p>
              <div className="bg-white/50 rounded-lg p-3 border border-spice-100">
                <p className="text-sm text-desert-700">
                  <strong>The difference:</strong> A wallet that bought yesterday and one that held for two years both pass Guild.xyz requirements. Only Arrakis distinguishes them.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-8 rounded-2xl border border-spice-200">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mb-4">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">9-Tier Progression</h3>
              <p className="text-desert-600 mb-4">
                Guild.xyz assigns roles based on requirements. Arrakis creates a progression journey from Outsider to Naib. Your community has visible hierarchy that drives engagement through status.
              </p>
              <div className="bg-white/50 rounded-lg p-3 border border-spice-100">
                <p className="text-sm text-desert-700">
                  <strong>The difference:</strong> Guild.xyz: "You meet requirements." Arrakis: "You're rank #12 and climbing toward Fedaykin Elite."
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-8 rounded-2xl border border-spice-200">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mb-4">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Telegram Support</h3>
              <p className="text-desert-600 mb-4">
                Guild.xyz focuses on Discord and web platforms. Arrakis supports both Discord and Telegram for communities that span both platforms.
              </p>
            </div>

            <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-8 rounded-2xl border border-spice-200">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mb-4">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Shadow Mode</h3>
              <p className="text-desert-600 mb-4">
                Guild.xyz is all-or-nothing. Arrakis lets you run in shadow mode alongside any existing setup — see conviction data before committing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Free vs Paid Trade-off */}
      <section className="section bg-desert-900 text-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                The Free vs Paid Trade-off
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="bg-white/5 p-8 rounded-2xl border border-white/10">
                <h3 className="text-xl font-bold mb-4 text-green-400">Guild.xyz: Free Everything</h3>
                <p className="text-sand-300">
                  Guild.xyz offers all features free. That's compelling. But there's no engagement intelligence at any price point.
                </p>
              </div>
              <div className="bg-spice-500/20 p-8 rounded-2xl border border-spice-500/30">
                <h3 className="text-xl font-bold mb-4 text-spice-400">Arrakis: Free + Premium Intelligence</h3>
                <p className="text-sand-300">
                  Free tier for basic gating. Premium ($99/mo) adds the intelligence layer that no free tool can provide.
                </p>
              </div>
            </div>

            {/* Pricing Comparison Table */}
            <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-6 text-sand-300">Feature Set</th>
                    <th className="text-center py-4 px-6 text-sand-300">Guild.xyz</th>
                    <th className="text-center py-4 px-6 text-spice-400">Arrakis</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: 'Basic token-gating', guild: 'Free', arrakis: 'Free' },
                    { feature: '60+ chains', guild: 'Free', arrakis: '—' },
                    { feature: 'Off-chain requirements', guild: 'Free', arrakis: '—' },
                    { feature: 'Conviction scoring', guild: '— Not available', arrakis: '$99/mo' },
                    { feature: '9-tier progression', guild: '— Not available', arrakis: '$99/mo' },
                    { feature: 'Analytics + insights', guild: '— Not available', arrakis: '$99/mo' },
                    { feature: 'Telegram support', guild: '— Not available', arrakis: '$99/mo' }
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-3 px-6 text-sand-200">{row.feature}</td>
                      <td className="py-3 px-6 text-center">
                        <span className={row.guild === 'Free' ? 'text-green-400' : 'text-sand-500'}>{row.guild}</span>
                      </td>
                      <td className="py-3 px-6 text-center">
                        <span className={row.arrakis === 'Free' ? 'text-green-400' : row.arrakis === '—' ? 'text-sand-500' : 'text-spice-400'}>{row.arrakis}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-12 grid md:grid-cols-2 gap-8">
              <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                <h4 className="font-bold text-sand-200 mb-2">If you only need access control:</h4>
                <p className="text-sand-300">Guild.xyz free tier is hard to beat.</p>
              </div>
              <div className="bg-spice-500/20 p-6 rounded-xl border border-spice-500/30">
                <h4 className="font-bold text-spice-400 mb-2">If you need to know who your diamond hands are:</h4>
                <p className="text-sand-200">No amount of Guild.xyz features provides that. Arrakis Premium does.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Section */}
      <section className="section bg-sand-50">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-4">
                ROI Calculation
              </h2>
              <p className="text-xl text-desert-600">
                Why pay when free exists?
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-sand-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-desert-900">Scenario: Planning a $1M airdrop</h3>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-sand-50 p-4 rounded-xl">
                  <h4 className="font-bold text-desert-900 mb-2">With Guild.xyz (free):</h4>
                  <ul className="text-sm text-desert-600 space-y-1">
                    <li>• Gate access based on requirements</li>
                    <li>• No insight into farmer vs believer</li>
                    <li className="text-red-600 font-medium">• Risk: 50%+ goes to farmers</li>
                  </ul>
                </div>
                <div className="bg-spice-50 p-4 rounded-xl border border-spice-200">
                  <h4 className="font-bold text-desert-900 mb-2">With Arrakis ($99/mo):</h4>
                  <ul className="text-sm text-desert-600 space-y-1">
                    <li>• Conviction scoring identifies diamond hands</li>
                    <li>• Weight distribution by commitment</li>
                    <li className="text-spice-600 font-medium">• Better allocation to true community</li>
                  </ul>
                </div>
              </div>

              <div className="bg-gradient-to-r from-spice-100 to-spice-50 p-4 rounded-xl border border-spice-200 text-center">
                <p className="text-desert-800">
                  <strong className="text-spice-600">ROI:</strong> If conviction data improves distribution by even 10%, that's <strong>$100,000 value</strong> for $99/month.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* When to Choose */}
      <section className="section">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-4">
              When to Choose Each
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-2xl border border-sand-200">
              <h3 className="text-xl font-bold text-desert-900 mb-6">Choose Guild.xyz If:</h3>
              <ul className="space-y-3">
                {[
                  'Free is the primary requirement',
                  'You need 60+ chain support',
                  'You want off-chain requirements',
                  'Access management is the only goal',
                  "You don't need conviction data"
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
                  'You need to identify valuable members',
                  "You're planning airdrops",
                  'You want tiered progression',
                  'You need Telegram support',
                  'You value engagement over access'
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
                  'You want Guild.xyz for off-chain requirements',
                  'You want Arrakis for on-chain intelligence',
                  'Different use cases in same community'
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
      <section className="section bg-sand-50">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-4">
              Common Questions
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            {[
              {
                q: '"Guild.xyz is free — why pay for Arrakis?"',
                a: "Free is great for access control. But when you need to know who your diamond hands are — not just who holds tokens — Guild.xyz can't tell you. No free tool can. That intelligence has value, especially before airdrops."
              },
              {
                q: '"Guild.xyz has more chain support (60+ vs Score Service)"',
                a: "True. If you need specific chains Guild.xyz supports that we don't, use Guild.xyz for those. But chain count doesn't reveal conviction. A holder on 60 chains means nothing if you don't know which ones are farmers."
              },
              {
                q: '"I need off-chain requirements (GitHub, Twitter)"',
                a: "Guild.xyz is better for that. We focus on on-chain intelligence. Consider using both — Guild.xyz for off-chain requirements, Arrakis for conviction-based tiering."
              },
              {
                q: '"Everything I need is free with Guild.xyz"',
                a: "If access management is all you need, stay with Guild.xyz. But ask: Do you know who your top 7 holders are? Who's held longest? Who's accumulating vs selling? If those questions matter, that's where we start."
              }
            ].map((item, i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-sand-200">
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
              Free works until you need to know who matters
            </h2>
            <p className="text-xl text-sand-300 mb-8">
              Guild.xyz gates access. Arrakis identifies value. Start free, upgrade when conviction data proves its worth.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/pricing" className="btn bg-spice-500 hover:bg-spice-600 text-white px-8 py-4 text-lg">
                Start Free
                <ArrowRight className="ml-2 w-5 h-5 inline" />
              </Link>
              <Link href="/pricing" className="btn bg-white/10 hover:bg-white/20 text-white border border-white/30 px-8 py-4 text-lg">
                See Pricing
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-6">
              {[
                'Free tier available',
                'Shadow mode evaluation',
                'No credit card required'
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
