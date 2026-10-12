// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

// Two font families only: the script for buttons and accents, the condensed face for headings.
// Body copy uses the device's own font, so it needs no download.
const font = (file, weight) => ({ src: [`./src/assets/fonts/${file}`], weight, style: 'normal' });

export default defineConfig({
  site: 'https://doughboysyarmouth.co.uk',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'never',
  },
  devToolbar: { enabled: false },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Barlow Condensed',
      cssVariable: '--font-cond',
      display: 'swap',
      fallbacks: ['Arial Narrow', 'sans-serif'],
      options: { variants: [font('barlow-condensed-latin-700.woff2', 700), font('barlow-condensed-latin-800.woff2', 800)] },
    },
    {
      provider: fontProviders.local(),
      name: 'Leckerli One',
      cssVariable: '--font-script',
      display: 'swap',
      fallbacks: ['cursive'],
      options: { variants: [font('leckerli-one-latin-400.woff2', 400)] },
    },
  ],
});
