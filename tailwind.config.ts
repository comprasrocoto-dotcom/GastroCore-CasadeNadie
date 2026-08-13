import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ambar: {
          DEFAULT: '#1E3A5F',
          50: '#EEF2F7',
          100: '#D8E1EC',
          200: '#B3C4D8',
          300: '#8AA3BF',
          400: '#5B7896',
          500: '#3A587A',
          600: '#1E3A5F',
          700: '#16324D',
          800: '#122A41',
          900: '#0E2033',
        },
        salvia: {
          DEFAULT: '#64748B',
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        brand: { DEFAULT: '#1E3A5F', hover: '#16324D' },
        accent: { DEFAULT: '#2563EB', 50: '#EFF6FF', 100: '#DBEAFE', 600: '#2563EB', 700: '#1D4ED8' },
        success: { DEFAULT: '#16A34A', 50: '#F0FDF4', 100: '#DCFCE7', 600: '#16A34A', 700: '#15803D' },
        warning: { DEFAULT: '#F59E0B', 50: '#FFFBEB', 100: '#FEF3C7', 600: '#D97706' },
        danger: { DEFAULT: '#DC2626', 50: '#FEF2F2', 100: '#FEE2E2', 600: '#DC2626', 700: '#B91C1C' },
        ink: '#0F172A',
        muted: '#64748B',
        surface: '#FFFFFF',
        line: '#E2E8F0',
        base: { light: '#F8FAFC', dark: '#0F172A' },
      },
      fontFamily: {
        display: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 2px 8px rgba(15,23,42,.05)',
        'card-hover': '0 6px 20px rgba(15,23,42,.08)',
      },
      borderRadius: { xl: '0.875rem' },
    },
  },
  plugins: [],
};

export default config;
