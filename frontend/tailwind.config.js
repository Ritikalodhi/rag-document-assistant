/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Newsreader', 'Georgia', 'serif'],
        ui: ['Inter', 'system-ui', 'sans-serif'],
        code: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        display: ['40px', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'h1': ['30px', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
        'h2': ['22px', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        'h3': ['18px', { lineHeight: '1.3', letterSpacing: '-0.005em' }],
        'body': ['15px', { lineHeight: '1.5' }],
        'caption': ['13px', { lineHeight: '1.4' }],
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
        'lg': '12px',
      },
      maxWidth: {
        content: '1200px',
      },
      transitionDuration: {
        DEFAULT: '150ms',
        '250': '250ms',
      },
    },
  },
  plugins: [],
};