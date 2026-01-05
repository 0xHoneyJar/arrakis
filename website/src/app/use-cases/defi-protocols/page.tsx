'use client';

import Link from 'next/link';
import {
  Shield,
  Users,
  Bot,
  Lock,
  ArrowRight,
  CheckCircle,
  Vote,
  Target,
  FileCheck,
  Scale,
  Database,
  Activity,
  Server,
  Zap,
  Clock,
  Building2,
  BadgeCheck,
  Workflow,
  MessageSquare,
  Eye
} from 'lucide-react';

export default function DeFiProtocolsPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="section bg-gradient-to-b from-desert-900 to-desert-800 text-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-spice-500/20 text-spice-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Building2 className="w-4 h-4" />
              For DeFi Protocols
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Enterprise-grade community infrastructure for protocols
            </h1>
            <p className="text-xl md:text-2xl text-sand-300 mb-8 max-w-3xl mx-auto">
              Your protocol has 50,000 Discord members. But only 500 vote. Arrakis identifies your real users, drives governance participation, and prevents sybil attacks on distributions — with the security your foundation requires.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/pricing" className="btn bg-spice-500 hover:bg-spice-600 text-white px-8 py-4 text-lg">
                Contact Sales
              </Link>
              <Link href="/pricing" className="btn bg-white/10 hover:bg-white/20 text-white border border-white/30 px-8 py-4 text-lg">
                Start Enterprise Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="section bg-sand-50">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-4">
              Protocol-scale community challenges
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-2xl border border-sand-200 shadow-sm">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
                <Vote className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Low Governance Participation</h3>
              <p className="text-desert-600">
                50,000 token holders. 500 voters. Your governance proposals pass with a handful of wallets while the community watches from the sidelines.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-sand-200 shadow-sm">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
                <Bot className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Sybil Attacks on Distributions</h3>
              <p className="text-desert-600">
                Your last airdrop went to 10,000 addresses. 8,000 were farmers. Millions in tokens distributed to bots and mercenaries. Your real users got diluted.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-sand-200 shadow-sm">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Can't Distinguish Users from Speculators</h3>
              <p className="text-desert-600">
                Someone who's used your protocol for two years looks the same as someone who bought the dip yesterday. No way to tier access by actual commitment.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-sand-200 shadow-sm">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Security Requirements for Tooling</h3>
              <p className="text-desert-600">
                Your foundation requires audit trails, data isolation, and enterprise SLAs. Current Discord bots are held together with duct tape.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="section">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-4">
              Arrakis delivers protocol-grade community intelligence
            </h2>
            <p className="text-xl text-desert-600 max-w-3xl mx-auto">
              Built for scale. Secured by design. Arrakis brings on-chain intelligence to your community operations with the infrastructure your foundation requires.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-8 rounded-2xl border border-spice-200">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mb-4">
                <Vote className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Drive Governance Participation</h3>
              <p className="text-desert-600 mb-4">
                Tiered recognition makes governance matter. Your most active users earn visible status. Council-level access creates incentive to engage.
              </p>
              <div className="flex items-center gap-2 text-spice-600 font-medium">
                <CheckCircle className="w-5 h-5" />
                <span>Result: Voters feel recognized. Participation increases.</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-8 rounded-2xl border border-spice-200">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Prevent Sybil Attacks</h3>
              <p className="text-desert-600 mb-4">
                Conviction scoring identifies real users before distributions. Analyze holding duration, trading patterns, and protocol usage to separate believers from farmers.
              </p>
              <div className="flex items-center gap-2 text-spice-600 font-medium">
                <CheckCircle className="w-5 h-5" />
                <span>Result: Airdrops go to contributors, not bots.</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-8 rounded-2xl border border-spice-200">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Enterprise Security</h3>
              <p className="text-desert-600 mb-4">
                PostgreSQL with row-level security (RLS) for complete tenant isolation. Full audit trail for compliance. Two-tier architecture ensures core gating works even during maintenance.
              </p>
              <div className="flex items-center gap-2 text-spice-600 font-medium">
                <CheckCircle className="w-5 h-5" />
                <span>Result: Security you can document to your foundation.</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-8 rounded-2xl border border-spice-200">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mb-4">
                <Scale className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Scale for Protocol Communities</h3>
              <p className="text-desert-600 mb-4">
                Built to handle 100,000+ Discord members per community and 1,000+ concurrent tenants. Sub-100ms eligibility checks. 99.9% uptime architecture.
              </p>
              <div className="flex items-center gap-2 text-spice-600 font-medium">
                <CheckCircle className="w-5 h-5" />
                <span>Result: Infrastructure that grows with your protocol.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="section bg-desert-900 text-white">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How DeFi protocols use Arrakis
            </h2>
          </div>

          <div className="space-y-16 max-w-4xl mx-auto">
            {/* Use Case 1 */}
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-spice-500 rounded-lg flex items-center justify-center font-bold">
                  1
                </div>
                <h3 className="text-2xl font-bold">Governance Engagement</h3>
              </div>

              <div className="mb-6">
                <h4 className="text-spice-400 font-semibold mb-2">The Scenario:</h4>
                <p className="text-sand-300">
                  Your protocol has active governance with weekly proposals. But participation hovers at 5-10%. You need engaged token holders to actually vote.
                </p>
              </div>

              <div className="mb-6">
                <h4 className="text-spice-400 font-semibold mb-3">With Arrakis:</h4>
                <ul className="space-y-2">
                  {[
                    'Implement conviction-based tier progression',
                    'Create governance council (Naib tier) for top stakeholders',
                    'Gate governance discussion channels by tier',
                    'Award "Voter" badges for participation',
                    'Surface conviction analytics to identify engaged vs passive holders'
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-spice-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sand-200">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-spice-500/20 rounded-xl p-4 border border-spice-500/30">
                <h4 className="text-spice-400 font-semibold mb-1">The Outcome:</h4>
                <p className="text-white">
                  Governance becomes aspirational. Members see a path to council status. Participation increases as engagement becomes visible.
                </p>
              </div>
            </div>

            {/* Use Case 2 */}
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-spice-500 rounded-lg flex items-center justify-center font-bold">
                  2
                </div>
                <h3 className="text-2xl font-bold">Sybil-Resistant Token Distribution</h3>
              </div>

              <div className="mb-6">
                <h4 className="text-spice-400 font-semibold mb-2">The Scenario:</h4>
                <p className="text-sand-300">
                  Your protocol is planning a major token distribution. You've been burned before — farmers claimed 60% of your last airdrop. This distribution needs to reward real users.
                </p>
              </div>

              <div className="mb-6">
                <h4 className="text-spice-400 font-semibold mb-3">With Arrakis:</h4>
                <ul className="space-y-2">
                  {[
                    'Run conviction analysis across all eligible addresses',
                    'Identify patterns: holding duration, accumulation, protocol usage correlation',
                    'Flag suspicious addresses (recent buyers, known farmer patterns)',
                    'Export conviction-weighted eligibility data',
                    'Execute distribution that rewards genuine users'
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-spice-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sand-200">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-spice-500/20 rounded-xl p-4 border border-spice-500/30">
                <h4 className="text-spice-400 font-semibold mb-1">The Outcome:</h4>
                <p className="text-white">
                  Distribution goes to users who've been contributing for months, not addresses that appeared last week. Your community sees fairness.
                </p>
              </div>
            </div>

            {/* Use Case 3 */}
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-spice-500 rounded-lg flex items-center justify-center font-bold">
                  3
                </div>
                <h3 className="text-2xl font-bold">Enterprise Compliance</h3>
              </div>

              <div className="mb-6">
                <h4 className="text-spice-400 font-semibold mb-2">The Scenario:</h4>
                <p className="text-sand-300">
                  Your foundation requires audit trails for community tooling decisions. You need to demonstrate data isolation and security practices for governance processes.
                </p>
              </div>

              <div className="mb-6">
                <h4 className="text-spice-400 font-semibold mb-3">With Arrakis:</h4>
                <ul className="space-y-2">
                  {[
                    'Enable full audit trail logging (Enterprise tier)',
                    'Row-level security ensures complete tenant isolation',
                    'Export logs for compliance review',
                    'Document security architecture for foundation',
                    'Establish SLA-backed support relationship'
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-spice-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sand-200">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-spice-500/20 rounded-xl p-4 border border-spice-500/30">
                <h4 className="text-spice-400 font-semibold mb-1">The Outcome:</h4>
                <p className="text-white">
                  Your foundation has the documentation they need. Security review passes. Operations are audit-ready.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Architecture Section */}
      <section className="section bg-sand-50">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-4">
              Enterprise Architecture
            </h2>
            <p className="text-xl text-desert-600 max-w-3xl mx-auto">
              Security infrastructure built for protocol-scale operations
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-white p-8 rounded-2xl border border-sand-200 shadow-sm">
              <div className="w-12 h-12 bg-desert-900 rounded-xl flex items-center justify-center mb-4">
                <Database className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Row-Level Security (RLS)</h3>
              <p className="text-desert-600">
                Every database query is scoped to your protocol's data. Complete tenant isolation at the database level — not application-level filtering. Your data never touches other tenants.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-sand-200 shadow-sm">
              <div className="w-12 h-12 bg-desert-900 rounded-xl flex items-center justify-center mb-4">
                <FileCheck className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Audit Trail</h3>
              <p className="text-desert-600">
                Full logging of all administrative actions: who changed tier configuration, when roles were modified, what eligibility criteria were updated. Export capability for compliance review.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-sand-200 shadow-sm">
              <div className="w-12 h-12 bg-desert-900 rounded-xl flex items-center justify-center mb-4">
                <Workflow className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Two-Tier Architecture</h3>
              <p className="text-desert-600">
                Tier 1 (Native Reader) provides basic balance/ownership verification always. Tier 2 (Score Service) for advanced analytics with circuit breaker fallback. Your community access is never down.
              </p>
            </div>
          </div>

          {/* Infrastructure Stack */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-2xl border border-sand-200 shadow-sm">
              <h3 className="text-xl font-bold text-desert-900 mb-6">Infrastructure Stack</h3>
              <div className="space-y-4">
                {[
                  { label: 'Database', value: 'PostgreSQL 15 with RLS' },
                  { label: 'Cache', value: 'Redis 7' },
                  { label: 'Secrets', value: 'HCP Vault' },
                  { label: 'Cloud', value: 'AWS EKS (Kubernetes)' },
                  { label: 'Monitoring', value: 'Datadog' }
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-sand-100 last:border-0">
                    <span className="text-desert-600">{item.label}</span>
                    <span className="font-medium text-desert-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-sand-200 shadow-sm">
              <h3 className="text-xl font-bold text-desert-900 mb-6">Performance Targets</h3>
              <div className="space-y-4">
                {[
                  { label: 'Basic eligibility check', value: '<100ms' },
                  { label: 'Advanced eligibility check', value: '<500ms' },
                  { label: 'Concurrent communities', value: '1,000+' },
                  { label: 'Members per community', value: '100,000+' },
                  { label: 'Uptime SLA', value: '99.9%' }
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-sand-100 last:border-0">
                    <span className="text-desert-600">{item.label}</span>
                    <span className="font-bold text-spice-600">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="section">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-4">
              Features for Protocols
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              {
                icon: Activity,
                name: 'Conviction Scoring',
                description: 'Sybil-resistant distributions, governance weighting'
              },
              {
                icon: BadgeCheck,
                name: '9-Tier Progression',
                description: 'Governance council, stakeholder hierarchy'
              },
              {
                icon: Eye,
                name: 'Custom Themes',
                description: 'Protocol branding, custom tier names'
              },
              {
                icon: FileCheck,
                name: 'Audit Trail',
                description: 'Compliance documentation, foundation requirements'
              },
              {
                icon: Zap,
                name: 'API Access',
                description: 'Custom integrations, governance tooling'
              },
              {
                icon: Server,
                name: 'Multi-Chain',
                description: 'L2 deployments, cross-chain holdings'
              }
            ].map((feature, i) => (
              <div key={i} className="bg-sand-50 p-6 rounded-xl border border-sand-200">
                <feature.icon className="w-8 h-8 text-spice-500 mb-3" />
                <h3 className="font-bold text-desert-900 mb-2">{feature.name}</h3>
                <p className="text-desert-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Recommended Tier */}
          <div className="max-w-3xl mx-auto bg-gradient-to-br from-desert-900 to-desert-800 rounded-2xl p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-8 h-8 text-spice-400" />
              <h3 className="text-2xl font-bold">Recommended: Enterprise Tier</h3>
            </div>
            <p className="text-3xl font-bold text-spice-400 mb-6">$399/month</p>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
              {[
                'All Premium features',
                'Unlimited Discord servers',
                'Full API access',
                'Audit trail for compliance',
                'Dedicated Slack support',
                'Custom SLA available'
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-spice-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="bg-white/10 rounded-xl p-4 mb-6">
              <p className="text-sand-300">
                <strong className="text-white">Custom Pricing</strong> available for 10+ community operations, custom security requirements, extended support SLAs, and on-premise considerations.
              </p>
            </div>

            <Link href="/pricing" className="btn bg-spice-500 hover:bg-spice-600 text-white w-full py-4 text-lg">
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Objection Handling */}
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
                q: '"We need to security review"',
                a: 'Happy to share architecture documentation. PostgreSQL RLS ensures complete data isolation. No shared tenant data. We welcome security audits.'
              },
              {
                q: '"Can you handle our scale?"',
                a: 'Built for 100,000+ members per community and 1,000+ concurrent tenants. Sub-100ms eligibility checks. Two-tier architecture ensures availability.'
              },
              {
                q: '"We have custom requirements"',
                a: "Enterprise tier includes custom themes, API access, and dedicated support. For unique requirements, let's discuss custom arrangements."
              },
              {
                q: '"What about uptime?"',
                a: 'Two-tier provider architecture means core token-gating works even if advanced features are degraded. Circuit breakers ensure graceful fallback. 99.9% uptime SLA available.'
              },
              {
                q: '"Our current tools work fine"',
                a: 'Shadow mode lets you evaluate alongside existing setup. See conviction data for your community without changing anything. Compare intelligence quality before deciding.'
              },
              {
                q: '"This seems expensive compared to free alternatives"',
                a: 'Free tools provide access control. Arrakis provides intelligence. Preventing one sybil-captured airdrop saves more than years of Enterprise subscription. The ROI is in distribution quality.'
              }
            ].map((item, i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-sand-200">
                <h3 className="font-bold text-desert-900 mb-2">{item.q}</h3>
                <p className="text-desert-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section className="section">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-4">
              Start with an Enterprise evaluation
            </h2>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { step: 1, title: 'Contact Sales', desc: "Discuss your protocol's requirements" },
                { step: 2, title: 'Security Review', desc: 'We provide architecture documentation' },
                { step: 3, title: 'Trial Setup', desc: 'Guided Enterprise configuration' },
                { step: 4, title: 'Shadow Mode', desc: 'Evaluate conviction data alongside current tools' },
                { step: 5, title: 'Foundation Review', desc: 'Document security and compliance' },
                { step: 6, title: 'Production Deployment', desc: 'Full rollout with dedicated support' }
              ].map((item, i) => (
                <div key={i} className="bg-sand-50 p-6 rounded-xl border border-sand-200">
                  <div className="w-10 h-10 bg-spice-500 rounded-lg flex items-center justify-center text-white font-bold mb-4">
                    {item.step}
                  </div>
                  <h3 className="font-bold text-desert-900 mb-2">{item.title}</h3>
                  <p className="text-desert-600 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section bg-gradient-to-b from-desert-900 to-desert-950 text-white">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Protocol-grade community infrastructure
            </h2>
            <p className="text-xl text-sand-300 mb-8">
              Enterprise security. Conviction intelligence. The foundation your protocol requires.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/pricing" className="btn bg-spice-500 hover:bg-spice-600 text-white px-8 py-4 text-lg">
                Contact Sales
                <ArrowRight className="ml-2 w-5 h-5 inline" />
              </Link>
              <Link href="/pricing" className="btn bg-white/10 hover:bg-white/20 text-white border border-white/30 px-8 py-4 text-lg">
                Schedule Architecture Review
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                'PostgreSQL RLS for data isolation',
                'Full audit trail',
                '99.9% uptime SLA',
                'Dedicated support'
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5 text-spice-400" />
                  <span className="text-sand-300 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
