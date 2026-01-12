'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChartLineUp, Diamond, Medal } from '@phosphor-icons/react';

const features = [
  { id: 'analytics', label: 'On-chain Analytics', icon: ChartLineUp, color: '#f4a460' },
  { id: 'conviction', label: 'Conviction Scoring', icon: Diamond, color: '#c45c4a' },
  { id: 'tiers', label: 'Tier Progression', icon: Medal, color: '#5b8fb9' },
] as const;

type FeatureId = (typeof features)[number]['id'];

export function HeroFeatures() {
  const [activeFeature, setActiveFeature] = useState<FeatureId>('analytics');

  return (
    <div className="mt-auto relative">
      {/* Hero image - absolute positioned to sit on the line, centered */}
      <motion.div
        className="absolute left-1/2 -bottom-16 w-[600px] h-[450px] z-10 pointer-events-none"
        initial={{ opacity: 0, y: 40, x: '-50%', scale: 0.95 }}
        animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
        transition={{
          duration: 0.7,
          ease: [0.16, 1, 0.3, 1] as const,
          delay: 0.5,
        }}
        style={{
          backgroundImage: 'url(/images/hero-figures.png)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center bottom',
        }}
      />

      {/* Features strip */}
      <motion.div
        className="w-full border-y border-sand-dim/20 mb-20 bg-sand-dim/10 relative z-0 mt-48"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: 0.5,
          ease: [0.16, 1, 0.3, 1] as const,
          delay: 0.6,
        }}
        style={{
          maskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
        }}
      >
        <div className="py-3" />
      </motion.div>
    </div>
  );
}
