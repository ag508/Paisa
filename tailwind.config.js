/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f7f7f8',
          100: '#ebebee',
          200: '#d4d4db',
          300: '#a9a9b6',
          400: '#76768a',
          500: '#4b4b5e',
          600: '#323242',
          700: '#23232f',
          800: '#171720',
          900: '#0c0c12',
        },
        accent: {
          DEFAULT: '#7c5cff',
          soft: '#e9e3ff',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,15,20,0.04), 0 4px 12px rgba(15,15,20,0.04)',
      },
    },
  },
  plugins: [],
};
