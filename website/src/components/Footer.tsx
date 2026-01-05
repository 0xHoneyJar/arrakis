import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-24">
      <div className="text-sand-dim text-xs overflow-hidden">
        {'─'.repeat(80)}
      </div>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="text-sand-dim mb-3">// product</div>
          <div className="space-y-2">
            <Link href="/features" className="block text-sand hover:text-sand-bright">
              features
            </Link>
            <Link href="/pricing" className="block text-sand hover:text-sand-bright">
              pricing
            </Link>
            <Link href="https://docs.arrakis.gg" className="block text-sand hover:text-sand-bright">
              docs
            </Link>
          </div>
        </div>

        <div>
          <div className="text-sand-dim mb-3">// use-cases</div>
          <div className="space-y-2">
            <Link href="/use-cases/daos" className="block text-sand hover:text-sand-bright">
              daos
            </Link>
            <Link href="/use-cases/nft-projects" className="block text-sand hover:text-sand-bright">
              nft-projects
            </Link>
            <Link href="/use-cases/defi-protocols" className="block text-sand hover:text-sand-bright">
              defi-protocols
            </Link>
          </div>
        </div>

        <div>
          <div className="text-sand-dim mb-3">// compare</div>
          <div className="space-y-2">
            <Link href="/compare/vs-collabland" className="block text-sand hover:text-sand-bright">
              vs-collabland
            </Link>
            <Link href="/compare/vs-guild" className="block text-sand hover:text-sand-bright">
              vs-guild
            </Link>
          </div>
        </div>

        <div>
          <div className="text-sand-dim mb-3">// links</div>
          <div className="space-y-2">
            <Link href="/about" className="block text-sand hover:text-sand-bright">
              about
            </Link>
            <a
              href="https://discord.gg/thehoneyjar"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sand hover:text-sand-bright"
            >
              discord
            </a>
            <a
              href="https://twitter.com/0xHoneyJar"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sand hover:text-sand-bright"
            >
              twitter
            </a>
          </div>
        </div>
      </div>

      <div className="mt-12 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm">
        <div className="text-sand-dim">
          <span className="text-spice">&gt;</span> ARRAKIS // engagement intelligence for web3
        </div>
        <div className="flex gap-6 text-sand-dim">
          <Link href="/legal/terms" className="hover:text-sand">
            terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-sand">
            privacy
          </Link>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </div>

      <div className="mt-8 text-sand-dim/50 text-xs space-y-1">
        <div>{`/* the spice must flow */`}</div>
        <div>
          design inspired by{' '}
          <a
            href="https://github.com/ertdfgcvb/play.core"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sand-dim/70 hover:text-sand-dim underline"
          >
            play.core
          </a>
        </div>
      </div>
    </footer>
  );
}
