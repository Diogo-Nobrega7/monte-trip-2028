/** Cores vêm de variáveis CSS (src/index.css) — tema claro/escuro sem duplicar classes. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`
export default {
  darkMode: ['variant', [
    '@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) & }',
    ':root[data-theme="dark"] &',
  ]],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), raised: v('raised'), sunken: v('sunken'), line: v('line'),
        ink: v('ink'), muted: v('muted'), faint: v('faint'),
        navy: v('navy'), 'navy-2': v('navy-2'),
        accent: v('accent'), 'accent-ink': v('accent-ink'),
        gold: v('gold'), 'gold-ink': v('gold-ink'),
        ok: v('ok'), warn: v('warn'), bad: v('bad'),
      },
      fontFamily: {
        sans: ['"Schibsted Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Schibsted Grotesk"', 'ui-sans-serif', 'sans-serif'],
      },
      borderRadius: { sm: '8px', md: '12px', lg: '16px', xl: '22px' },
      boxShadow: { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)' },
      transitionTimingFunction: { out: 'cubic-bezier(.2,.7,.2,1)' },
    },
  },
  plugins: [],
}
