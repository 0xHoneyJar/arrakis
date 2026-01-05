'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = {
  main: [
    { name: 'Features', href: '/features' },
    { name: 'Pricing', href: '/pricing' },
    {
      name: 'Use Cases',
      href: '#',
      children: [
        { name: 'For DAOs', href: '/use-cases/daos' },
        { name: 'For NFT Projects', href: '/use-cases/nft-projects' },
        { name: 'For DeFi Protocols', href: '/use-cases/defi-protocols' },
      ],
    },
    {
      name: 'Compare',
      href: '#',
      children: [
        { name: 'vs Collab.Land', href: '/compare/vs-collabland' },
        { name: 'vs Guild.xyz', href: '/compare/vs-guild' },
      ],
    },
  ],
  secondary: [
    { name: 'Docs', href: 'https://docs.arrakis.xyz', external: true },
    { name: 'Login', href: '/login' },
  ],
};

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/80 backdrop-blur-md">
      <nav className="container-custom">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-spice-500">
              <span className="text-lg font-bold text-white">A</span>
            </div>
            <span className="text-xl font-bold text-stone-900">Arrakis</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-1 lg:flex">
            {navigation.main.map((item) =>
              item.children ? (
                <div
                  key={item.name}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(item.name)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900">
                    {item.name}
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {openDropdown === item.name && (
                    <div className="absolute left-0 top-full mt-1 w-48 rounded-lg border border-stone-200 bg-white py-2 shadow-lg">
                      {item.children.map((child) => (
                        <Link
                          key={child.name}
                          href={child.href}
                          className="block px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={item.name}
                  href={item.href}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                >
                  {item.name}
                </Link>
              )
            )}
          </div>

          {/* Desktop Right Side */}
          <div className="hidden items-center gap-4 lg:flex">
            {navigation.secondary.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className="text-sm font-medium text-stone-600 hover:text-stone-900"
              >
                {item.name}
              </Link>
            ))}
            <Link href="/signup" className="btn-primary text-sm">
              Start Free
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 text-stone-600" />
            ) : (
              <Menu className="h-6 w-6 text-stone-600" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="border-t border-stone-200 py-4 lg:hidden">
            <div className="flex flex-col gap-2">
              {navigation.main.map((item) =>
                item.children ? (
                  <div key={item.name} className="flex flex-col">
                    <span className="px-4 py-2 text-sm font-medium text-stone-400">
                      {item.name}
                    </span>
                    {item.children.map((child) => (
                      <Link
                        key={child.name}
                        href={child.href}
                        className="px-8 py-2 text-sm text-stone-600 hover:text-stone-900"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                )
              )}
              <div className="mt-4 border-t border-stone-200 pt-4">
                {navigation.secondary.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    target={item.external ? '_blank' : undefined}
                    className="block px-4 py-2 text-sm text-stone-600 hover:text-stone-900"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
                <div className="px-4 pt-2">
                  <Link
                    href="/signup"
                    className="btn-primary block w-full text-center text-sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Start Free
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
