/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        ui: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        code: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        display: ['42px', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        h1: ['30px', { lineHeight: '1.2', letterSpacing: '-0.018em' }],
        h2: ['22px', { lineHeight: '1.25', letterSpacing: '-0.012em' }],
        h3: ['18px', { lineHeight: '1.3', letterSpacing: '-0.006em' }],
        body: ['15px', { lineHeight: '1.55' }],
        caption: ['13px', { lineHeight: '1.45' }],
      },
      spacing: {
        '4': '4px',
        '8': '8px',
        '12': '12px',
        '16': '16px',
        '24': '24px',
        '32': '32px',
        '48': '48px',
        '64': '64px',
      },
      borderRadius: {
        DEFAULT: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '24px',
      },
      maxWidth: {
        content: '1280px',
      },
      transitionDuration: {
        DEFAULT: '150ms',
        '250': '250ms',
        '350': '350ms',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulse2: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.5s linear infinite',
        'fade-up': 'fade-up 0.3s ease forwards',
      },
      boxShadow: {
        'glow-sm': '0 0 12px -2px var(--glow-color, rgba(99,138,255,0.35))',
        'glow-md': '0 0 24px -4px var(--glow-color, rgba(99,138,255,0.3))',
        'inner-sm': 'inset 0 1px 0 0 rgba(255,255,255,0.06)',
        card: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)',
        'card-dark': '0 1px 3px rgba(0,0,0,0.3), 0 4px 20px rgba(0,0,0,0.25)',
        'card-hover': '0 2px 8px rgba(0,0,0,0.07), 0 8px 28px rgba(0,0,0,0.09)',
      },
    },
  },
  plugins: [],
};