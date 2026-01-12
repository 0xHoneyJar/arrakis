'use client';

import { motion } from 'framer-motion';

const stats = [
  { value: '0', label: 'queries to write' },
  { value: '15', label: 'min setup' },
  { value: '6h', label: 'auto-refresh' },
  { value: '#1', label: 'dune team' },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.15,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export function StatsGrid() {
  return (
    <motion.div
      className="mt-12 border border-sand-dim/30 p-8 lg:p-12"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <div className="font-display text-4xl lg:text-5xl text-spice mb-2">
              {stat.value}
            </div>
            <div className="text-sand-dim text-xs font-mono">{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
