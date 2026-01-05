import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - Arrakis',
  description: 'Terms of Service for Arrakis, the engagement intelligence platform for Web3 communities.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="container-custom py-16 md:py-24">
        <div className="max-w-3xl mx-auto prose prose-lg prose-sand">
          <h1 className="text-4xl font-bold text-desert-900 mb-8">Terms of Service</h1>

          <p className="text-desert-600">
            <strong>Effective Date:</strong> January 1, 2026<br />
            <strong>Last Updated:</strong> January 3, 2026
          </p>

          <hr className="my-8 border-sand-200" />

          <h2>1. Introduction</h2>
          <p>
            Welcome to Arrakis ("Company," "we," "us," or "our"). These Terms of Service ("Terms") govern your access to and use of the Arrakis platform, including our website at arrakis.xyz, Discord bot, Telegram bot, APIs, and related services (collectively, the "Service").
          </p>
          <p>
            By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, do not use the Service.
          </p>
          <p>
            If you are using the Service on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms.
          </p>

          <h2>2. Definitions</h2>
          <ul>
            <li><strong>"Account"</strong> means the account you create to access the Service.</li>
            <li><strong>"Community"</strong> means a Discord server or Telegram group managed using the Service.</li>
            <li><strong>"Content"</strong> means any data, text, graphics, or other materials uploaded, downloaded, or appearing on the Service.</li>
            <li><strong>"User"</strong> means any individual who accesses or uses the Service.</li>
            <li><strong>"Community Operator"</strong> means a User who manages a Community using the Service.</li>
            <li><strong>"Community Member"</strong> means a User who participates in a Community managed by the Service.</li>
            <li><strong>"Wallet Address"</strong> means a blockchain address connected to the Service.</li>
          </ul>

          <h2>3. Eligibility</h2>
          <p>To use the Service, you must:</p>
          <ul>
            <li>Be at least 18 years of age, or the age of legal majority in your jurisdiction</li>
            <li>Have the legal capacity to enter into these Terms</li>
            <li>Not be prohibited from using the Service under applicable laws</li>
          </ul>
          <p>By using the Service, you represent and warrant that you meet these eligibility requirements.</p>

          <h2>4. Account Registration</h2>

          <h3>4.1 Account Creation</h3>
          <p>To access certain features of the Service, you must create an Account. You agree to:</p>
          <ul>
            <li>Provide accurate, current, and complete information</li>
            <li>Maintain and promptly update your Account information</li>
            <li>Maintain the security of your Account credentials</li>
            <li>Accept responsibility for all activities under your Account</li>
            <li>Notify us immediately of any unauthorized use</li>
          </ul>

          <h3>4.2 Wallet Connection</h3>
          <p>The Service requires connecting cryptocurrency wallet addresses to verify blockchain asset ownership. By connecting a wallet, you:</p>
          <ul>
            <li>Confirm you control the connected wallet address</li>
            <li>Authorize us to read publicly available blockchain data associated with that address</li>
            <li>Understand that wallet connections are used for verification purposes only</li>
          </ul>
          <p>We do not have access to your private keys, seed phrases, or the ability to execute transactions on your behalf.</p>

          <h2>5. Service Description</h2>

          <h3>5.1 Platform Overview</h3>
          <p>Arrakis is an engagement intelligence platform for Web3 communities that provides:</p>
          <ul>
            <li>Token-gating and access control for Discord and Telegram</li>
            <li>Conviction scoring based on on-chain behavior analysis</li>
            <li>Tiered progression systems for community engagement</li>
            <li>Badge and gamification features</li>
            <li>Analytics and insights for community operators</li>
          </ul>

          <h3>5.2 Service Tiers</h3>
          <p>The Service is offered in multiple tiers:</p>
          <ul>
            <li><strong>Free (Explorer):</strong> Basic token-gating and features</li>
            <li><strong>Premium (Sietch):</strong> Advanced features including conviction scoring</li>
            <li><strong>Enterprise (Naib Council):</strong> Custom features for larger organizations</li>
          </ul>
          <p>Feature availability varies by tier as described on our Pricing page.</p>

          <h3>5.3 Discord and Telegram Integration</h3>
          <p>The Service operates through Discord and Telegram bots. By adding our bots to your server or group, you:</p>
          <ul>
            <li>Grant the bot necessary permissions to function (manage roles, send messages, etc.)</li>
            <li>Accept responsibility for compliance with Discord's and Telegram's terms of service</li>
            <li>Understand that bot functionality depends on third-party platform availability</li>
          </ul>

          <h2>6. Acceptable Use</h2>

          <h3>6.1 Permitted Uses</h3>
          <p>You may use the Service to:</p>
          <ul>
            <li>Manage token-gated access to your community</li>
            <li>Implement tiered member experiences</li>
            <li>Analyze community engagement and holder behavior</li>
            <li>Distribute badges and recognition to community members</li>
          </ul>

          <h3>6.2 Prohibited Uses</h3>
          <p>You agree NOT to use the Service to:</p>
          <ul>
            <li>Violate any applicable law, regulation, or third-party rights</li>
            <li>Engage in fraud, money laundering, or other financial crimes</li>
            <li>Harass, abuse, or harm other users</li>
            <li>Distribute malware or engage in hacking activities</li>
            <li>Circumvent security features or access controls</li>
            <li>Scrape, data mine, or extract data beyond intended use</li>
            <li>Resell, sublicense, or redistribute the Service without authorization</li>
            <li>Interfere with the proper functioning of the Service</li>
            <li>Use the Service for illegal gambling or securities offerings</li>
            <li>Impersonate another person or entity</li>
            <li>Manipulate conviction scores or tier rankings fraudulently</li>
          </ul>

          <h3>6.3 Community Operator Responsibilities</h3>
          <p>If you are a Community Operator, you additionally agree to:</p>
          <ul>
            <li>Comply with Discord's and Telegram's terms of service</li>
            <li>Inform your Community Members about the use of Arrakis</li>
            <li>Not use the Service to discriminate against protected classes</li>
            <li>Take responsibility for the content and conduct within your Community</li>
            <li>Maintain appropriate moderation of your Community</li>
          </ul>

          <h2>7. Payment Terms</h2>

          <h3>7.1 Fees</h3>
          <p>Paid tiers require payment of fees as described on our Pricing page. By subscribing to a paid tier, you agree to pay all applicable fees.</p>

          <h3>7.2 Billing</h3>
          <ul>
            <li><strong>Monthly Plans:</strong> Billed monthly in advance</li>
            <li><strong>Annual Plans:</strong> Billed annually in advance at the discounted rate</li>
            <li><strong>Payment Methods:</strong> Credit card or other accepted payment methods</li>
            <li><strong>Currency:</strong> All fees are in USD unless otherwise specified</li>
          </ul>

          <h3>7.3 Automatic Renewal</h3>
          <p>Subscriptions automatically renew at the end of each billing period unless cancelled. You may cancel at any time through your Account settings.</p>

          <h3>7.4 Refunds</h3>
          <ul>
            <li><strong>Monthly Plans:</strong> No refunds for partial months</li>
            <li><strong>Annual Plans:</strong> Pro-rated refund available within 30 days of purchase</li>
            <li><strong>Downgrades:</strong> Take effect at the next billing cycle</li>
          </ul>

          <h3>7.5 Price Changes</h3>
          <p>We may change our prices with 30 days' notice. Continued use after a price change constitutes acceptance of the new pricing.</p>

          <h3>7.6 Taxes</h3>
          <p>You are responsible for all applicable taxes. Stated prices do not include taxes unless explicitly noted.</p>

          <h2>8. Intellectual Property</h2>

          <h3>8.1 Our Intellectual Property</h3>
          <p>The Service, including its design, features, and content, is owned by Arrakis and protected by intellectual property laws. You receive a limited, non-exclusive, non-transferable license to use the Service in accordance with these Terms.</p>

          <h3>8.2 Your Content</h3>
          <p>You retain ownership of Content you submit to the Service. By submitting Content, you grant us a worldwide, non-exclusive, royalty-free license to use, store, and process that Content to provide the Service.</p>

          <h3>8.3 Feedback</h3>
          <p>If you provide feedback or suggestions about the Service, you grant us the right to use that feedback without obligation to you.</p>

          <h3>8.4 Trademarks</h3>
          <p>"Arrakis," our logo, and related marks are trademarks of the Company. You may not use our trademarks without prior written permission.</p>

          <h2>9. Data and Privacy</h2>

          <h3>9.1 Privacy Policy</h3>
          <p>Our collection and use of personal information is governed by our <a href="/legal/privacy" className="text-spice-600 hover:text-spice-700">Privacy Policy</a>, which is incorporated into these Terms by reference.</p>

          <h3>9.2 Data Processing</h3>
          <p>By using the Service, you acknowledge that we process:</p>
          <ul>
            <li>Wallet addresses and associated public blockchain data</li>
            <li>Discord and Telegram user identifiers</li>
            <li>Community configuration and settings</li>
            <li>Usage analytics and logs</li>
          </ul>

          <h3>9.3 Data Security</h3>
          <p>We implement reasonable security measures to protect your data, including row-level security for multi-tenant isolation. However, no system is completely secure, and we cannot guarantee absolute security.</p>

          <h3>9.4 Data Retention</h3>
          <p>We retain data as described in our Privacy Policy. You may request data deletion subject to legal retention requirements.</p>

          <h2>10. Third-Party Services</h2>

          <h3>10.1 Integrations</h3>
          <p>The Service integrates with third-party platforms including:</p>
          <ul>
            <li>Discord</li>
            <li>Telegram</li>
            <li>Blockchain networks and RPC providers</li>
            <li>Payment processors</li>
          </ul>
          <p>Your use of these integrations is subject to their respective terms of service.</p>

          <h3>10.2 Blockchain Data</h3>
          <p>The Service reads publicly available blockchain data. We are not responsible for:</p>
          <ul>
            <li>Accuracy of blockchain data</li>
            <li>Blockchain network availability or performance</li>
            <li>Gas fees or transaction costs (not applicable to our read-only operations)</li>
          </ul>

          <h3>10.3 Links</h3>
          <p>The Service may contain links to third-party websites. We are not responsible for the content or practices of linked sites.</p>

          <h2>11. Disclaimers</h2>

          <h3>11.1 "As Is" Service</h3>
          <p className="uppercase text-sm">
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>

          <h3>11.2 No Financial Advice</h3>
          <p>The Service provides analytics and insights about community engagement and blockchain holdings. This is NOT financial, investment, legal, or tax advice. You should consult appropriate professionals before making financial decisions.</p>

          <h3>11.3 Blockchain Risks</h3>
          <p>You acknowledge the inherent risks of blockchain technology, including:</p>
          <ul>
            <li>Price volatility of digital assets</li>
            <li>Regulatory uncertainty</li>
            <li>Smart contract vulnerabilities</li>
            <li>Network congestion and failures</li>
          </ul>

          <h3>11.4 Service Availability</h3>
          <p>We do not guarantee uninterrupted or error-free Service. We may modify, suspend, or discontinue features at any time.</p>

          <h2>12. Limitation of Liability</h2>

          <h3>12.1 Exclusion of Damages</h3>
          <p className="uppercase text-sm">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, ARRAKIS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL.
          </p>

          <h3>12.2 Liability Cap</h3>
          <p className="uppercase text-sm">
            OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) $100.
          </p>

          <h3>12.3 Exceptions</h3>
          <p>Some jurisdictions do not allow the exclusion or limitation of certain damages. In such jurisdictions, our liability is limited to the maximum extent permitted by law.</p>

          <h2>13. Indemnification</h2>
          <p>You agree to indemnify, defend, and hold harmless Arrakis and its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including reasonable attorneys' fees) arising from:</p>
          <ul>
            <li>Your use of the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any third-party rights</li>
            <li>Your Content or Community activities</li>
          </ul>

          <h2>14. Termination</h2>

          <h3>14.1 Termination by You</h3>
          <p>You may terminate your Account at any time through Account settings or by contacting us. Termination does not entitle you to a refund except as specified in Section 7.4.</p>

          <h3>14.2 Termination by Us</h3>
          <p>We may suspend or terminate your access to the Service at any time, with or without cause, with or without notice. Grounds for termination include:</p>
          <ul>
            <li>Violation of these Terms</li>
            <li>Fraudulent, abusive, or illegal activity</li>
            <li>Non-payment of fees</li>
            <li>Extended inactivity</li>
            <li>Requests by law enforcement</li>
          </ul>

          <h3>14.3 Effect of Termination</h3>
          <p>Upon termination:</p>
          <ul>
            <li>Your right to use the Service ceases immediately</li>
            <li>We may delete your Account and associated data</li>
            <li>Provisions that by their nature should survive will survive (including Sections 8, 11, 12, 13, and 15)</li>
          </ul>

          <h2>15. Dispute Resolution</h2>

          <h3>15.1 Governing Law</h3>
          <p>These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles.</p>

          <h3>15.2 Arbitration</h3>
          <p>Any disputes arising from these Terms or the Service shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association. The arbitration shall take place in Delaware, and the language shall be English.</p>

          <h3>15.3 Class Action Waiver</h3>
          <p>You agree to resolve disputes on an individual basis and waive the right to participate in class actions or class arbitrations.</p>

          <h3>15.4 Exceptions</h3>
          <p>Notwithstanding the above, either party may seek injunctive relief in any court of competent jurisdiction.</p>

          <h2>16. General Provisions</h2>

          <h3>16.1 Entire Agreement</h3>
          <p>These Terms, together with our Privacy Policy, constitute the entire agreement between you and Arrakis regarding the Service.</p>

          <h3>16.2 Severability</h3>
          <p>If any provision of these Terms is found unenforceable, the remaining provisions will continue in effect.</p>

          <h3>16.3 Waiver</h3>
          <p>Our failure to enforce any provision of these Terms does not constitute a waiver of that provision.</p>

          <h3>16.4 Assignment</h3>
          <p>You may not assign these Terms without our consent. We may assign these Terms without restriction.</p>

          <h3>16.5 Notices</h3>
          <p>We may provide notices through the Service, email, or other reasonable means. You may contact us at legal@arrakis.xyz.</p>

          <h3>16.6 Force Majeure</h3>
          <p>We are not liable for failures or delays resulting from circumstances beyond our reasonable control.</p>

          <h2>17. Changes to Terms</h2>
          <p>We may modify these Terms at any time. We will notify you of material changes through the Service or by email. Continued use of the Service after changes constitutes acceptance of the modified Terms.</p>

          <h2>18. Contact Information</h2>
          <p>For questions about these Terms, contact us at:</p>
          <p>
            <strong>Arrakis</strong><br />
            Email: legal@arrakis.xyz<br />
            Website: arrakis.xyz
          </p>

          <hr className="my-8 border-sand-200" />

          <p className="text-sm text-desert-500 italic">
            This document was last updated on January 3, 2026. Please review our Privacy Policy for information about how we handle your data.
          </p>
        </div>
      </div>
    </main>
  );
}
