'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChartLineUp, Diamond, Medal, CaretDown } from '@phosphor-icons/react';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { cn } from '@/lib/utils';

const productItems = [
  {
    title: 'Analytics',
    description: 'On-chain data, no SQL',
    href: '/#analytics',
    icon: ChartLineUp,
    color: '#f4a460',
  },
  {
    title: 'Conviction',
    description: 'Score diamond hands',
    href: '/#conviction',
    icon: Diamond,
    color: '#c45c4a',
  },
  {
    title: 'Tiers',
    description: 'Dynamic Discord roles',
    href: '/#tiers',
    icon: Medal,
    color: '#5b8fb9',
  },
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black">
      <div className="border-b border-sand-dim/20">
        <nav className="flex items-center justify-between max-w-5xl mx-auto px-6 py-4">
          {/* Left - Logo */}
          <Link href="/" className="font-display text-xl text-sand-bright hover:text-spice transition-colors duration-150 ease-out">
            Arrakis
          </Link>

          {/* Center - Navigation */}
          <div className="hidden md:flex items-center absolute left-1/2 -translate-x-1/2">
            <NavigationMenu>
              <NavigationMenuList className="gap-1">
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent text-sand-dim hover:text-sand-bright hover:bg-transparent data-[state=open]:bg-transparent data-[state=open]:text-sand-bright font-mono text-sm">
                    Product
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid grid-cols-3 w-[720px] gap-3 p-3 bg-black border border-sand-dim/30">
                      {productItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <li key={item.title}>
                            <NavigationMenuLink asChild>
                              <Link
                                href={item.href}
                                className="flex flex-col justify-start items-start w-[224px] h-[224px] p-5 hover:bg-sand-dim/10 transition-all duration-200 group border border-sand-dim/20"
                              >
                                <div
                                  className="w-6 h-6 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-200"
                                  style={{ backgroundColor: item.color }}
                                >
                                  <Icon weight="fill" className="w-3 h-3 text-black" />
                                </div>
                                <div className="text-sand-bright text-xs font-medium mb-1">
                                  {item.title}
                                </div>
                                <p className="text-sand-dim text-[10px] leading-tight">
                                  {item.description}
                                </p>
                              </Link>
                            </NavigationMenuLink>
                          </li>
                        );
                      })}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <Link href="/use-cases" legacyBehavior passHref>
                    <NavigationMenuLink className="bg-transparent text-sand-dim hover:text-sand-bright font-mono text-sm px-4 py-2 transition-colors duration-150">
                      Use Cases
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <Link href="/pricing" legacyBehavior passHref>
                    <NavigationMenuLink className="bg-transparent text-sand-dim hover:text-sand-bright font-mono text-sm px-4 py-2 transition-colors duration-150">
                      Pricing
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Right - CTA */}
          <div className="hidden md:flex items-center">
            <Link
              href="https://discord.gg/thehoneyjar"
              target="_blank"
              className="px-4 py-2 bg-spice text-black font-mono text-sm uppercase tracking-wider hover:bg-spice-bright transition-colors duration-150 ease-out flex items-center gap-2"
            >
              Discord
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
              </svg>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-sand-dim hover:text-sand-bright transition-colors duration-150 ease-out"
            aria-label="Toggle menu"
          >
            [{isOpen ? '−' : '+'}]
          </button>
        </nav>
      </div>

      {/* Mobile nav */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="flex flex-col gap-3 py-4 px-6 bg-black border-b border-sand-dim/20">
          <div className="text-sand-dim/50 text-xs font-mono uppercase tracking-wider">Product</div>
          {productItems.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="text-sand-dim hover:text-sand-bright text-sm transition-colors duration-150 ease-out pl-2"
            >
              {item.title}
            </Link>
          ))}

          <div className="text-sand-dim/50 text-xs font-mono uppercase tracking-wider mt-2">Pages</div>
          <Link
            href="/use-cases"
            onClick={() => setIsOpen(false)}
            className="text-sand-dim hover:text-sand-bright text-sm transition-colors duration-150 ease-out pl-2"
          >
            Use Cases
          </Link>
          <Link
            href="/pricing"
            onClick={() => setIsOpen(false)}
            className="text-sand-dim hover:text-sand-bright text-sm transition-colors duration-150 ease-out pl-2"
          >
            Pricing
          </Link>

          <div className="text-sand-dim/50 text-xs font-mono uppercase tracking-wider mt-2">Connect</div>
          <Link
            href="https://discord.gg/thehoneyjar"
            target="_blank"
            className="text-spice hover:text-spice-bright text-sm transition-colors duration-150 ease-out pl-2"
          >
            Discord
          </Link>
        </div>
      </div>
    </header>
  );
}
