/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,js,html}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50:  '#ffffff',
          100: '#f7f8fa',
          200: '#eceef3',
          300: '#d4d8e2',
          400: '#a9b0c2',
          500: '#7a8298',
          600: '#525a72',
          700: '#3a4159',
          800: '#262c40',
          900: '#171b2a',
        },
        accent: {
          DEFAULT: '#4f46e5',
          muted: '#818cf8',
          soft: '#eef2ff',
        },
        success: '#059669',
        warn: '#d97706',
        danger: '#dc2626',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
