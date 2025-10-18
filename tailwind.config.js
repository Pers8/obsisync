/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}', './public/**/*.html'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['Iosevka Nerd Font', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      colors: {
        'obs-bg': '#0a1023',
        'obs-panel': '#0c142e',
        'obs-border': '#1a2342',
        'obs-accent': '#7aa2f7',
        'obs-muted': '#8ba2c8',
        'obs-green': '#34d399',
        'obs-red': '#ef4444',
        // new: section background and stroke color
        'obs-section': '#06162a',
        'obs-stroke': '#34567B'
      }
    }
  },
  plugins: []
}
