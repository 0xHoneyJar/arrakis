'use client';

import { motion } from 'framer-motion';

const users = [
  { name: '@diamond_hands', score: 95, highlight: true },
  { name: '@steady_stacker', score: 78, highlight: true },
  { name: '@curious_collector', score: 52, highlight: false },
  { name: '@paper_trader', score: 23, highlight: false },
];

function getBarColor(score: number): string {
  if (score >= 70) return '#c45c4a'; // ruby
  if (score >= 50) return '#f4a460'; // spice
  return '#6b6245'; // sand-dim
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const row = {
  hidden: { opacity: 0, x: -12 },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

export function ConvictionBoard() {
  return (
    <motion.div
      className="mt-12 border border-sand-dim/30 p-8 lg:p-12"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
    >
      <div className="space-y-4">
        {users.map((user, index) => (
          <motion.div
            key={user.name}
            className="flex items-center justify-between"
            variants={row}
          >
            <span
              className={`text-sm ${user.highlight ? 'text-sand' : 'text-sand-dim'}`}
            >
              {user.name}
            </span>
            <div className="flex items-center gap-3">
              <div className="w-32 lg:w-48 h-2 bg-sand-dim/20 overflow-hidden">
                <motion.div
                  className="h-full"
                  style={{ backgroundColor: getBarColor(user.score) }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${user.score}%` }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                    delay: index * 0.08 + 0.2,
                  }}
                />
              </div>
              <motion.span
                className={`text-sm font-mono w-8 ${user.highlight ? 'text-sand-bright' : 'text-sand-dim'}`}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.08 + 0.4,
                }}
              >
                {user.score}
              </motion.span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
