/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0faf0',
          100: '#dcf1dc',
          200: '#bae3bb',
          300: '#87cd89',
          400: '#54B45B',
          500: '#3d9644',
          600: '#2f7a35',
          700: '#28612d',
          800: '#234e27',
          900: '#1d4121',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card': '0 4px 12px 0 rgb(0 0 0 / 0.06), 0 1px 3px 0 rgb(0 0 0 / 0.04)',
        'elevated': '0 8px 24px 0 rgb(0 0 0 / 0.08), 0 2px 6px 0 rgb(0 0 0 / 0.04)',
        'brand': '0 4px 14px 0 rgb(84 180 91 / 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease',
        'slide-up': 'slideUp 250ms ease',
        'slide-in-right': 'slideInRight 300ms ease',
      },
      keyframes: {
        fadeIn:       { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:      { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(20px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
}