import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'void-black': '#0A0A0F',
        'purgatory-purple': '#1A0A2E',
        'ember-gold': '#C8922A',
        'ghost-white': '#E8E8F0',
        'warning-red': '#FF3B3B',
        'spirit-teal': '#00F5C4',
        'bureaucrat-grey': '#3A3A4A',
        'glitch-pink': '#FF2D78',
        'shadow-blue': '#0D1B2A',
      },
      fontFamily: {
        body: ['Rajdhani', 'sans-serif'],
        mono: ['Share Tech Mono', 'monospace'],
        display: ['Cinzel Decorative', 'serif'],
      },
      boxShadow: {
        panel: '0 2px 16px rgba(0,0,0,0.6)',
        'glow-gold': '0 0 12px rgba(200,146,42,0.3)',
        'glow-teal': '0 0 12px rgba(0,245,196,0.2)',
        'glow-red': '0 0 12px rgba(255,59,59,0.3)',
      },
      borderRadius: {
        sharp: '4px',
        panel: '8px',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '12': '48px',
        '16': '64px',
      },
    },
  },
  plugins: [],
} satisfies Config;
