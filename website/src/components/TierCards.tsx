'use client';

import { motion } from 'framer-motion';
import { Crown, Sword, Users, UserCircle } from '@phosphor-icons/react';

const tiers = [
  {
    name: 'Naib Council',
    score: '90+',
    color: '#5b8fb9',
    icon: Crown,
    highlight: true,
  },
  {
    name: 'Fedaykin',
    score: '70+',
    color: '#c45c4a',
    icon: Sword,
    highlight: false,
  },
  {
    name: 'Fremen',
    score: '50+',
    color: '#f4a460',
    icon: Users,
    highlight: false,
  },
  {
    name: 'Outsider',
    score: '0+',
    color: '#6b6245',
    icon: UserCircle,
    highlight: false,
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const card = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

export function TierCards() {
  return (
    <motion.div
      className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
    >
      {tiers.map((tier, index) => {
        const Icon = tier.icon;
        return (
          <motion.div
            key={tier.name}
            className="border border-sand-dim/30 p-6"
            variants={card}
          >
            {/* Icon with colored background */}
            <motion.div
              className="w-10 h-10 flex items-center justify-center mb-4"
              style={{ backgroundColor: tier.color }}
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1],
                delay: index * 0.06 + 0.15,
              }}
            >
              <Icon weight="fill" className="w-5 h-5 text-black" />
            </motion.div>
            {/* Tier name */}
            <div
              className={`text-sm font-mono mb-1 ${tier.highlight ? 'text-sand-bright' : 'text-sand'}`}
            >
              {tier.name}
            </div>
            {/* Score requirement */}
            <div className="text-sand-dim text-xs">Score {tier.score}</div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
