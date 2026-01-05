import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Arrakis',
  description: 'Privacy Policy for Arrakis. Learn how we collect, use, and protect your data.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="container-custom py-16 md:py-24">
        <div className="max-w-3xl mx-auto prose prose-lg prose-sand">
          <h1 className="text-4xl font-bold text-desert-900 mb-8">Privacy Policy</h1>

          <p className="text-desert-600">
            <strong>Effective Date:</strong> January 1, 2026<br />
            <strong>Last Updated:</strong> January 3, 2026
          </p>

          <hr className="my-8 border-sand-200" />

          <h2>1. Introduction</h2>
          <p>
            Arrakis ("Company," "we," "us," or "our") respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform, including our website at arrakis.xyz, Discord bot, Telegram bot, APIs, and related services (collectively, the "Service").
          </p>
          <p>
            Please read this Privacy Policy carefully. By using the Service, you consent to the practices described in this policy.
          </p>

          <h2>2. Information We Collect</h2>

          <h3>2.1 Information You Provide</h3>
          <p><strong>Account Information:</strong></p>
          <ul>
            <li>Email address (for account registration and communication)</li>
            <li>Username or display name</li>
            <li>Password (stored in hashed form)</li>
            <li>Payment information (processed by third-party payment processors)</li>
          </ul>

          <p><strong>Community Configuration:</strong></p>
          <ul>
            <li>Discord server settings and configurations</li>
            <li>Telegram group settings and configurations</li>
            <li>Token contract addresses and chain selections</li>
            <li>Tier thresholds and badge configurations</li>
            <li>Custom theme settings (Enterprise)</li>
          </ul>

          <h3>2.2 Information Collected Automatically</h3>
          <p><strong>Platform Identifiers:</strong></p>
          <ul>
            <li>Discord user ID</li>
            <li>Discord server ID</li>
            <li>Telegram user ID</li>
            <li>Telegram group ID</li>
          </ul>

          <p><strong>Wallet Information:</strong></p>
          <ul>
            <li>Public wallet addresses you connect to the Service</li>
            <li>Publicly available blockchain data associated with connected wallets (balances, transaction history, NFT ownership)</li>
          </ul>

          <p><strong>Usage Data:</strong></p>
          <ul>
            <li>Log data (IP address, browser type, device information)</li>
            <li>Feature usage patterns</li>
            <li>Error logs and diagnostic data</li>
            <li>Timestamps of interactions</li>
          </ul>

          <p><strong>Cookies and Similar Technologies:</strong></p>
          <ul>
            <li>Session cookies for authentication</li>
            <li>Preference cookies</li>
            <li>Analytics cookies (with consent where required)</li>
          </ul>

          <h3>2.3 Information from Third Parties</h3>
          <p><strong>Blockchain Data:</strong></p>
          <ul>
            <li>Public blockchain data via RPC providers and our Score Service</li>
            <li>This includes token balances, NFT ownership, transaction history, and other publicly available on-chain data</li>
          </ul>

          <p><strong>Platform APIs:</strong></p>
          <ul>
            <li>Information from Discord API (server membership, roles, permissions)</li>
            <li>Information from Telegram API (group membership, user status)</li>
          </ul>

          <h2>3. How We Use Your Information</h2>

          <h3>3.1 To Provide the Service</h3>
          <ul>
            <li>Verify blockchain asset ownership for token-gating</li>
            <li>Calculate conviction scores based on on-chain behavior</li>
            <li>Assign and manage tier roles in Discord and Telegram</li>
            <li>Award badges based on activity and achievements</li>
            <li>Generate analytics and insights for community operators</li>
            <li>Process payments for paid subscriptions</li>
          </ul>

          <h3>3.2 To Improve the Service</h3>
          <ul>
            <li>Analyze usage patterns to improve features</li>
            <li>Debug issues and fix errors</li>
            <li>Develop new features and capabilities</li>
            <li>Conduct research and analysis</li>
          </ul>

          <h3>3.3 To Communicate with You</h3>
          <ul>
            <li>Send service-related notifications</li>
            <li>Respond to support requests</li>
            <li>Provide important updates about your Account</li>
            <li>Send marketing communications (with consent, where required)</li>
          </ul>

          <h3>3.4 For Security and Compliance</h3>
          <ul>
            <li>Detect and prevent fraud or abuse</li>
            <li>Enforce our Terms of Service</li>
            <li>Comply with legal obligations</li>
            <li>Respond to legal requests</li>
          </ul>

          <h2>4. Legal Basis for Processing (GDPR)</h2>
          <p>If you are in the European Economic Area (EEA) or UK, we process your personal data based on the following legal grounds:</p>

          <div className="overflow-x-auto">
            <table className="min-w-full border border-sand-200">
              <thead className="bg-sand-50">
                <tr>
                  <th className="px-4 py-2 text-left border-b border-sand-200">Purpose</th>
                  <th className="px-4 py-2 text-left border-b border-sand-200">Legal Basis</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="px-4 py-2 border-b border-sand-100">Providing the Service</td><td className="px-4 py-2 border-b border-sand-100">Contract performance</td></tr>
                <tr><td className="px-4 py-2 border-b border-sand-100">Account management</td><td className="px-4 py-2 border-b border-sand-100">Contract performance</td></tr>
                <tr><td className="px-4 py-2 border-b border-sand-100">Payment processing</td><td className="px-4 py-2 border-b border-sand-100">Contract performance</td></tr>
                <tr><td className="px-4 py-2 border-b border-sand-100">Security and fraud prevention</td><td className="px-4 py-2 border-b border-sand-100">Legitimate interests</td></tr>
                <tr><td className="px-4 py-2 border-b border-sand-100">Service improvement</td><td className="px-4 py-2 border-b border-sand-100">Legitimate interests</td></tr>
                <tr><td className="px-4 py-2 border-b border-sand-100">Marketing communications</td><td className="px-4 py-2 border-b border-sand-100">Consent</td></tr>
                <tr><td className="px-4 py-2">Legal compliance</td><td className="px-4 py-2">Legal obligation</td></tr>
              </tbody>
            </table>
          </div>

          <h2>5. How We Share Your Information</h2>

          <h3>5.1 Service Providers</h3>
          <p>We share information with third-party service providers who assist in operating the Service:</p>

          <div className="overflow-x-auto">
            <table className="min-w-full border border-sand-200">
              <thead className="bg-sand-50">
                <tr>
                  <th className="px-4 py-2 text-left border-b border-sand-200">Provider Type</th>
                  <th className="px-4 py-2 text-left border-b border-sand-200">Purpose</th>
                  <th className="px-4 py-2 text-left border-b border-sand-200">Data Shared</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="px-4 py-2 border-b border-sand-100">Cloud hosting</td><td className="px-4 py-2 border-b border-sand-100">Infrastructure</td><td className="px-4 py-2 border-b border-sand-100">All service data</td></tr>
                <tr><td className="px-4 py-2 border-b border-sand-100">Payment processors</td><td className="px-4 py-2 border-b border-sand-100">Billing</td><td className="px-4 py-2 border-b border-sand-100">Payment information</td></tr>
                <tr><td className="px-4 py-2 border-b border-sand-100">Analytics providers</td><td className="px-4 py-2 border-b border-sand-100">Usage analysis</td><td className="px-4 py-2 border-b border-sand-100">Anonymized usage data</td></tr>
                <tr><td className="px-4 py-2 border-b border-sand-100">RPC providers</td><td className="px-4 py-2 border-b border-sand-100">Blockchain queries</td><td className="px-4 py-2 border-b border-sand-100">Wallet addresses</td></tr>
                <tr><td className="px-4 py-2">Email services</td><td className="px-4 py-2">Communications</td><td className="px-4 py-2">Email addresses</td></tr>
              </tbody>
            </table>
          </div>

          <h3>5.2 Community Visibility</h3>
          <p>Certain information is visible within communities you participate in:</p>
          <ul>
            <li>Your tier rank (if configured by Community Operator)</li>
            <li>Badges you've earned</li>
            <li>Conviction score (if displayed by Community Operator)</li>
            <li>Your Discord/Telegram username</li>
          </ul>
          <p>Community Operators can see aggregated analytics about their community members.</p>

          <h3>5.3 Public Blockchain Data</h3>
          <p>Wallet addresses and associated blockchain data are publicly available on blockchain networks. Our Service reads this public data but does not make private data public.</p>

          <h3>5.4 Legal Requirements</h3>
          <p>We may disclose information if required by law, court order, or government request, or if we believe disclosure is necessary to:</p>
          <ul>
            <li>Comply with legal obligations</li>
            <li>Protect our rights or property</li>
            <li>Prevent fraud or security issues</li>
            <li>Protect the safety of users or the public</li>
          </ul>

          <h3>5.5 Business Transfers</h3>
          <p>In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.</p>

          <h3>5.6 With Your Consent</h3>
          <p>We may share information for other purposes with your explicit consent.</p>

          <h2>6. Data Retention</h2>

          <h3>6.1 Retention Periods</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-sand-200">
              <thead className="bg-sand-50">
                <tr>
                  <th className="px-4 py-2 text-left border-b border-sand-200">Data Type</th>
                  <th className="px-4 py-2 text-left border-b border-sand-200">Retention Period</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="px-4 py-2 border-b border-sand-100">Account information</td><td className="px-4 py-2 border-b border-sand-100">Until account deletion + 30 days</td></tr>
                <tr><td className="px-4 py-2 border-b border-sand-100">Community configurations</td><td className="px-4 py-2 border-b border-sand-100">Until community removal + 30 days</td></tr>
                <tr><td className="px-4 py-2 border-b border-sand-100">Wallet connections</td><td className="px-4 py-2 border-b border-sand-100">Until disconnected + 30 days</td></tr>
                <tr><td className="px-4 py-2 border-b border-sand-100">Usage logs</td><td className="px-4 py-2 border-b border-sand-100">90 days</td></tr>
                <tr><td className="px-4 py-2 border-b border-sand-100">Analytics data</td><td className="px-4 py-2 border-b border-sand-100">24 months (anonymized)</td></tr>
                <tr><td className="px-4 py-2 border-b border-sand-100">Payment records</td><td className="px-4 py-2 border-b border-sand-100">7 years (legal requirement)</td></tr>
                <tr><td className="px-4 py-2">Support communications</td><td className="px-4 py-2">3 years</td></tr>
              </tbody>
            </table>
          </div>

          <h3>6.2 Deletion</h3>
          <p>When you delete your Account or disconnect a wallet:</p>
          <ul>
            <li>We remove your personal data within 30 days</li>
            <li>Some data may be retained in backups for up to 90 days</li>
            <li>Anonymized or aggregated data may be retained indefinitely</li>
            <li>Data required for legal compliance is retained as required</li>
          </ul>

          <h2>7. Data Security</h2>

          <h3>7.1 Security Measures</h3>
          <p>We implement appropriate technical and organizational measures to protect your data:</p>

          <p><strong>Technical Measures:</strong></p>
          <ul>
            <li>Encryption in transit (TLS/HTTPS)</li>
            <li>Encryption at rest for sensitive data</li>
            <li>PostgreSQL row-level security (RLS) for tenant isolation</li>
            <li>Secure password hashing</li>
            <li>Regular security assessments</li>
          </ul>

          <p><strong>Organizational Measures:</strong></p>
          <ul>
            <li>Access controls and authentication</li>
            <li>Employee security training</li>
            <li>Incident response procedures</li>
            <li>Vendor security assessments</li>
          </ul>

          <h3>7.2 Multi-Tenant Isolation</h3>
          <p>Our platform uses row-level security (RLS) at the database level to ensure complete isolation between communities. Your community's data cannot be accessed by other communities.</p>

          <h3>7.3 Security Limitations</h3>
          <p>No system is completely secure. While we strive to protect your data, we cannot guarantee absolute security. You are responsible for maintaining the security of your Account credentials and wallet private keys.</p>

          <h2>8. Your Rights</h2>

          <h3>8.1 General Rights</h3>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of your personal data</li>
            <li><strong>Correction:</strong> Request correction of inaccurate data</li>
            <li><strong>Deletion:</strong> Request deletion of your data</li>
            <li><strong>Portability:</strong> Receive your data in a portable format</li>
            <li><strong>Objection:</strong> Object to certain processing activities</li>
            <li><strong>Withdrawal:</strong> Withdraw consent where processing is based on consent</li>
          </ul>

          <h3>8.2 GDPR Rights (EEA/UK)</h3>
          <p>If you are in the EEA or UK, you additionally have the right to:</p>
          <ul>
            <li>Lodge a complaint with a supervisory authority</li>
            <li>Restrict processing in certain circumstances</li>
            <li>Not be subject to automated decision-making with legal effects</li>
          </ul>

          <h3>8.3 CCPA Rights (California)</h3>
          <p>If you are a California resident, you have the right to:</p>
          <ul>
            <li>Know what personal information we collect</li>
            <li>Request deletion of personal information</li>
            <li>Opt-out of the sale of personal information (we do not sell personal information)</li>
            <li>Non-discrimination for exercising your rights</li>
          </ul>

          <h3>8.4 Exercising Your Rights</h3>
          <p>To exercise your rights, contact us at privacy@arrakis.xyz. We will respond within the timeframes required by applicable law (typically 30 days).</p>
          <p>We may need to verify your identity before processing requests. For wallet-related requests, we may ask you to sign a message to prove wallet ownership.</p>

          <h2>9. Cookies and Tracking</h2>

          <h3>9.1 Types of Cookies</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-sand-200">
              <thead className="bg-sand-50">
                <tr>
                  <th className="px-4 py-2 text-left border-b border-sand-200">Cookie Type</th>
                  <th className="px-4 py-2 text-left border-b border-sand-200">Purpose</th>
                  <th className="px-4 py-2 text-left border-b border-sand-200">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="px-4 py-2 border-b border-sand-100">Essential</td><td className="px-4 py-2 border-b border-sand-100">Authentication, security</td><td className="px-4 py-2 border-b border-sand-100">Session</td></tr>
                <tr><td className="px-4 py-2 border-b border-sand-100">Functional</td><td className="px-4 py-2 border-b border-sand-100">Preferences, settings</td><td className="px-4 py-2 border-b border-sand-100">1 year</td></tr>
                <tr><td className="px-4 py-2">Analytics</td><td className="px-4 py-2">Usage statistics</td><td className="px-4 py-2">2 years</td></tr>
              </tbody>
            </table>
          </div>

          <h3>9.2 Managing Cookies</h3>
          <p>You can control cookies through your browser settings. Note that disabling certain cookies may affect Service functionality.</p>

          <h3>9.3 Do Not Track</h3>
          <p>We currently do not respond to "Do Not Track" browser signals, as there is no industry standard for interpretation.</p>

          <h2>10. International Data Transfers</h2>

          <h3>10.1 Transfer Locations</h3>
          <p>Your data may be transferred to and processed in countries outside your country of residence, including the United States and other countries where our service providers operate.</p>

          <h3>10.2 Transfer Safeguards</h3>
          <p>For transfers from the EEA/UK, we use appropriate safeguards including:</p>
          <ul>
            <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
            <li>Data processing agreements with service providers</li>
            <li>Additional technical measures where appropriate</li>
          </ul>

          <h2>11. Children's Privacy</h2>
          <p>The Service is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If we learn we have collected information from a child under 18, we will delete that information promptly.</p>

          <h2>12. Third-Party Links and Services</h2>
          <p>The Service may contain links to third-party websites or integrate with third-party services (Discord, Telegram, blockchain networks). This Privacy Policy does not apply to those third parties. We encourage you to review their privacy policies.</p>

          <h2>13. Specific Data Processing Activities</h2>

          <h3>13.1 Wallet Address Processing</h3>
          <p><strong>What we collect:</strong> Public wallet addresses you connect to the Service.</p>
          <p><strong>How we use it:</strong></p>
          <ul>
            <li>Verify token/NFT ownership for access control</li>
            <li>Calculate conviction scores based on public blockchain data</li>
            <li>Determine tier placement based on holdings and behavior</li>
          </ul>
          <p><strong>What we DON'T do:</strong></p>
          <ul>
            <li>Access your private keys or seed phrases</li>
            <li>Execute transactions on your behalf</li>
            <li>Store cryptocurrency or digital assets</li>
          </ul>

          <h3>13.2 Conviction Scoring</h3>
          <p><strong>What we analyze:</strong></p>
          <ul>
            <li>Holding duration of tokens/NFTs</li>
            <li>Trading patterns (accumulation vs distribution)</li>
            <li>Historical transaction data</li>
            <li>Cross-wallet behavior patterns</li>
          </ul>
          <p><strong>Data sources:</strong> Publicly available blockchain data only.</p>
          <p><strong>Purpose:</strong> Identify high-conviction community members for tiering and engagement features.</p>

          <h3>13.3 Discord/Telegram Data</h3>
          <p><strong>What we access:</strong></p>
          <ul>
            <li>User IDs and usernames</li>
            <li>Server/group membership</li>
            <li>Role assignments we manage</li>
          </ul>
          <p><strong>What we DON'T access:</strong></p>
          <ul>
            <li>Message content (except bot commands)</li>
            <li>Direct messages</li>
            <li>Voice chat data</li>
          </ul>

          <h2>14. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of material changes by:</p>
          <ul>
            <li>Posting the updated policy on our website</li>
            <li>Updating the "Last Updated" date</li>
            <li>Sending email notification for significant changes</li>
          </ul>
          <p>Your continued use of the Service after changes constitutes acceptance of the updated policy.</p>

          <h2>15. Contact Us</h2>
          <p>For questions about this Privacy Policy or to exercise your rights, contact us at:</p>
          <p>
            <strong>Arrakis</strong><br />
            Email: privacy@arrakis.xyz<br />
            Website: arrakis.xyz
          </p>

          <hr className="my-8 border-sand-200" />

          <p className="text-sm text-desert-500 italic">
            This document was last updated on January 3, 2026. Please also review our <a href="/legal/terms" className="text-spice-600 hover:text-spice-700">Terms of Service</a>.
          </p>
        </div>
      </div>
    </main>
  );
}
