/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,js,html}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50:  '#f7f8fa',
          100: '#eceef3',
          200: '#d4d8e2',
          300: '#a9b0c2',
          400: '#7a8298',
          500: '#525a72',
          600: '#3a4159',
          700: '#262c40',
          800: '#171b2a',
          900: '#0c0f1a',
        },
        accent: {
          DEFAULT: '#6366f1',
          muted: '#a5b4fc',
        },
        success: '#10b981',
        warn: '#f59e0b',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
