import Link from 'next/link';
import { Twitter, Github, MessageCircle } from 'lucide-react';

const navigation = {
  product: [
    { name: 'Features', href: '/features' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Docs', href: 'https://docs.arrakis.xyz' },
  ],
  useCases: [
    { name: 'DAOs', href: '/use-cases/daos' },
    { name: 'NFT Projects', href: '/use-cases/nft-projects' },
    { name: 'DeFi Protocols', href: '/use-cases/defi-protocols' },
  ],
  compare: [
    { name: 'vs Collab.Land', href: '/compare/vs-collabland' },
    { name: 'vs Guild.xyz', href: '/compare/vs-guild' },
  ],
  company: [
    { name: 'About', href: '/about' },
    { name: 'Blog', href: '/blog' },
    { name: 'Contact', href: 'mailto:hello@arrakis.xyz' },
  ],
  legal: [
    { name: 'Terms of Service', href: '/legal/terms' },
    { name: 'Privacy Policy', href: '/legal/privacy' },
  ],
  social: [
    { name: 'Twitter', href: 'https://twitter.com/arrakisxyz', icon: Twitter },
    { name: 'Discord', href: 'https://discord.gg/arrakis', icon: MessageCircle },
    { name: 'GitHub', href: 'https://github.com/arrakis', icon: Github },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="container-custom py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-6">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-spice-500">
                <span className="text-lg font-bold text-white">A</span>
              </div>
              <span className="text-xl font-bold text-stone-900">Arrakis</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-stone-500">
              Engagement intelligence for Web3 communities. Know your community,
              not just your holders.
            </p>
            <div className="mt-6 flex gap-4">
              {navigation.social.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stone-400 hover:text-stone-600"
                >
                  <item.icon className="h-5 w-5" />
                  <span className="sr-only">{item.name}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Product</h3>
            <ul className="mt-4 space-y-3">
              {navigation.product.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-stone-500 hover:text-stone-900"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Use Cases */}
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Use Cases</h3>
            <ul className="mt-4 space-y-3">
              {navigation.useCases.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-stone-500 hover:text-stone-900"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Compare */}
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Compare</h3>
            <ul className="mt-4 space-y-3">
              {navigation.compare.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-stone-500 hover:text-stone-900"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Company</h3>
            <ul className="mt-4 space-y-3">
              {navigation.company.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-stone-500 hover:text-stone-900"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-stone-200 pt-8 md:flex-row">
          <p className="text-sm text-stone-500">
            &copy; {new Date().getFullYear()} Arrakis. Built with conviction.
          </p>
          <div className="flex gap-6">
            {navigation.legal.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm text-stone-500 hover:text-stone-900"
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
