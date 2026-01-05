'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle,
  Users,
  Lightbulb,
  Shield,
  Eye,
  BarChart3,
  Award,
  Mail,
  Twitter,
  Github,
  MessageCircle,
  Zap,
  Database,
  Clock
} from 'lucide-react';

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="section bg-gradient-to-b from-desert-900 to-desert-800 text-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Built by the #1 team on Dune Analytics
            </h1>
            <p className="text-xl md:text-2xl text-sand-300 max-w-3xl mx-auto">
              We've spent years analyzing on-chain behavior. Arrakis is where we apply that expertise to help Web3 communities understand and engage their most valuable members.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="section">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-8">
              Our mission
            </h2>
            <div className="text-left space-y-6 text-lg text-desert-700">
              <p>
                Web3 communities deserve better than binary access control. They deserve to know who actually believes in their project — not just who holds their token.
              </p>
              <p className="text-xl font-bold text-spice-600">
                We're building engagement intelligence for Web3.
              </p>
              <p>
                Every community operator faces the same problem: token-gating tells you who can enter, but not who matters. Your biggest supporters look the same as day-one flippers. Your airdrops go to farmers. Your governance has 5% participation.
              </p>
              <p>
                Arrakis fixes this. We analyze on-chain behavior to identify conviction — who's been holding, who's accumulating, who's truly committed. Then we create tiered experiences that reward that commitment.
              </p>
              <p className="font-medium text-desert-900">
                The result: Communities that know their believers, reward their supporters, and drive real engagement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="section bg-sand-50">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-12 text-center">
              How we got here
            </h2>

            <div className="space-y-12">
              <div className="bg-white p-8 rounded-2xl border border-sand-200">
                <h3 className="text-xl font-bold text-desert-900 mb-4">The Problem We Kept Seeing</h3>
                <p className="text-desert-600 mb-6">
                  Working on Dune Analytics, we built dashboards for dozens of protocols and communities. Again and again, we saw the same pattern:
                </p>
                <ul className="space-y-3 text-desert-600">
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 mt-1">-</span>
                    Communities couldn't distinguish believers from speculators
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 mt-1">-</span>
                    Airdrops went to farmers, diluting loyal holders
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 mt-1">-</span>
                    Governance participation was abysmal despite thousands of token holders
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 mt-1">-</span>
                    Discord servers felt flat — everyone looked the same regardless of commitment
                  </li>
                </ul>
                <p className="text-desert-700 mt-6 font-medium">
                  Token-gating solved access. But it didn't solve <em>engagement</em>.
                </p>
              </div>

              <div className="bg-gradient-to-br from-spice-50 to-sand-50 p-8 rounded-2xl border border-spice-200">
                <h3 className="text-xl font-bold text-desert-900 mb-4">The Solution We Built</h3>
                <p className="text-desert-600">
                  We realized the same on-chain intelligence we used for analytics could be applied to community management. What if you could score conviction? What if tiers reflected commitment, not just balance? What if communities could identify their diamond hands before an airdrop, not after?
                </p>
                <p className="text-spice-600 font-bold mt-4">
                  Arrakis was born from these questions.
                </p>
              </div>

              <div className="bg-white p-8 rounded-2xl border border-sand-200">
                <h3 className="text-xl font-bold text-desert-900 mb-4">65+ Sprints of Building</h3>
                <p className="text-desert-600 mb-6">
                  This isn't a weekend project. Arrakis has been through 65+ development sprints:
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    'Enterprise-grade PostgreSQL with row-level security',
                    'Two-tier architecture for 99.9% uptime',
                    '9-tier progression system (SietchTheme)',
                    'Conviction scoring powered by our Dune expertise',
                    'Shadow mode for zero-risk adoption'
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-spice-500 flex-shrink-0 mt-0.5" />
                      <span className="text-desert-700">{item}</span>
                    </div>
                  ))}
                </div>
                <p className="text-desert-700 mt-6 font-medium">
                  We've built something serious because communities deserve serious infrastructure.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="section">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-4">
              Our values
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-sand-50 p-8 rounded-2xl border border-sand-200">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mb-4">
                <Lightbulb className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Intelligence Over Access</h3>
              <p className="text-desert-600">
                Token-gating is table stakes. The future is understanding <em>who matters</em> in your community, not just who can enter. We build tools that provide insight, not just control.
              </p>
            </div>

            <div className="bg-sand-50 p-8 rounded-2xl border border-sand-200">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mb-4">
                <Award className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Engagement Through Recognition</h3>
              <p className="text-desert-600">
                People engage when they feel recognized. Tiered progression, badges, and visible status create motivation. We believe gamification drives real community culture.
              </p>
            </div>

            <div className="bg-sand-50 p-8 rounded-2xl border border-sand-200">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mb-4">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Zero-Risk Adoption</h3>
              <p className="text-desert-600">
                Switching tools shouldn't require a leap of faith. Shadow mode lets communities try Arrakis alongside their current setup — validate accuracy before committing.
              </p>
            </div>

            <div className="bg-sand-50 p-8 rounded-2xl border border-sand-200">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-desert-900 mb-3">Security By Design</h3>
              <p className="text-desert-600">
                Multi-tenant infrastructure demands isolation. PostgreSQL row-level security isn't optional — it's foundational. We build for enterprise even when serving small communities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Credentials Section */}
      <section className="section bg-desert-900 text-white">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why trust us
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="bg-white/5 p-6 rounded-xl border border-white/10 text-center">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-lg mb-2">Dune Analytics Pedigree</h3>
              <p className="text-sand-300 text-sm">
                Top-starred dashboards on the leading blockchain analytics platform. We've analyzed on-chain data for protocols you use daily.
              </p>
            </div>

            <div className="bg-white/5 p-6 rounded-xl border border-white/10 text-center">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-lg mb-2">65+ Development Sprints</h3>
              <p className="text-sand-300 text-sm">
                This isn't a side project. Years of iteration, hardening, and real-world testing have shaped Arrakis into production-ready infrastructure.
              </p>
            </div>

            <div className="bg-white/5 p-6 rounded-xl border border-white/10 text-center">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Database className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-lg mb-2">Enterprise Architecture</h3>
              <p className="text-sand-300 text-sm">
                PostgreSQL with row-level security. Two-tier provider architecture. 99.9% uptime targets. Built for scale from day one.
              </p>
            </div>

            <div className="bg-white/5 p-6 rounded-xl border border-white/10 text-center">
              <div className="w-12 h-12 bg-spice-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-lg mb-2">Open Development</h3>
              <p className="text-sand-300 text-sm">
                Follow our progress. We ship consistently and communicate openly about what we're building and why.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="section bg-sand-50">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-desert-900 mb-4">
              Get in touch
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            {/* Contact Methods */}
            <div>
              <h3 className="text-xl font-bold text-desert-900 mb-6">Contact us</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-spice-100 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-spice-600" />
                  </div>
                  <div>
                    <p className="text-sm text-desert-500">General Inquiries</p>
                    <a href="mailto:hello@arrakis.xyz" className="text-spice-600 hover:text-spice-700 font-medium">
                      hello@arrakis.xyz
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-spice-100 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-spice-600" />
                  </div>
                  <div>
                    <p className="text-sm text-desert-500">Sales & Partnerships</p>
                    <a href="mailto:sales@arrakis.xyz" className="text-spice-600 hover:text-spice-700 font-medium">
                      sales@arrakis.xyz
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-spice-100 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-spice-600" />
                  </div>
                  <div>
                    <p className="text-sm text-desert-500">Support</p>
                    <a href="mailto:support@arrakis.xyz" className="text-spice-600 hover:text-spice-700 font-medium">
                      support@arrakis.xyz
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-spice-100 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-spice-600" />
                  </div>
                  <div>
                    <p className="text-sm text-desert-500">Security Issues</p>
                    <a href="mailto:security@arrakis.xyz" className="text-spice-600 hover:text-spice-700 font-medium">
                      security@arrakis.xyz
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div>
              <h3 className="text-xl font-bold text-desert-900 mb-6">Follow us</h3>
              <div className="space-y-4">
                <a
                  href="https://twitter.com/arrakis_xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-sand-200 hover:border-spice-300 transition-colors"
                >
                  <div className="w-10 h-10 bg-desert-900 rounded-lg flex items-center justify-center">
                    <Twitter className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-desert-900">Twitter / X</p>
                    <p className="text-sm text-desert-500">@arrakis_xyz</p>
                  </div>
                </a>

                <a
                  href="https://discord.gg/arrakis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-sand-200 hover:border-spice-300 transition-colors"
                >
                  <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-desert-900">Discord</p>
                    <p className="text-sm text-desert-500">Join our community</p>
                  </div>
                </a>

                <a
                  href="https://github.com/arrakis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-sand-200 hover:border-spice-300 transition-colors"
                >
                  <div className="w-10 h-10 bg-desert-900 rounded-lg flex items-center justify-center">
                    <Github className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-desert-900">GitHub</p>
                    <p className="text-sm text-desert-500">github.com/arrakis</p>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section bg-gradient-to-b from-desert-900 to-desert-950 text-white">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Ready to know your community?
            </h2>
            <p className="text-xl text-sand-300 mb-8">
              Start free with BasicTheme. See conviction data in shadow mode. Upgrade when the value is clear.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/pricing" className="btn bg-spice-500 hover:bg-spice-600 text-white px-8 py-4 text-lg">
                Start Free
                <ArrowRight className="ml-2 w-5 h-5 inline" />
              </Link>
              <Link href="/pricing" className="btn bg-white/10 hover:bg-white/20 text-white border border-white/30 px-8 py-4 text-lg">
                Schedule Demo
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
