/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#7C3AED',
        secondary: '#2563EB',
        dark: '#0A0A0F',
        glass: 'rgba(255,255,255,0.05)',
      },
    },
  },
  plugins: [],
};
