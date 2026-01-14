/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#007acc',
        secondary: '#005f99',
        accent: '#ffffff',
        text: '#333333',
        bg: '#e6f7ff',
        header: '#c45300',
        hover: '#66d9ef',
      },
      borderRadius: {
        card: '24px',
      },
      fontFamily: {
        sans: ['Rubik', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
