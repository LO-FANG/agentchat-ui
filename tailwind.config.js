/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      keyframes: {
        print: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' }
        },
        ticketIn: {
          '0%': { transform: 'translateY(-95%) scaleY(0.85)', opacity: '0', filter: 'blur(2px)' },
          '60%': { transform: 'translateY(6%) scaleY(1.02)', opacity: '1', filter: 'blur(0px)' },
          '100%': { transform: 'translateY(0) scaleY(1)', opacity: '1', filter: 'blur(0px)' }
        },
        ticketOut: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-100%)' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        marqueeL: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        },
        marqueeR: {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' }
        },
        breathe: {
          '0%': { transform: 'scale(0.92)', opacity: '0.55' },
          '50%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.92)', opacity: '0.55' }
        }
      },
      animation: {
        print: 'print 0.95s cubic-bezier(0.16, 1, 0.3, 1) both',
        'ticket-in': 'ticketIn 0.9s cubic-bezier(0.16, 1, 0.3, 1) both',
        'ticket-out': 'ticketOut 0.32s cubic-bezier(0.7, 0, 0.84, 0) both',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'marquee-l': 'marqueeL 14s linear infinite',
        'marquee-r': 'marqueeR 16s linear infinite',
        breathe: 'breathe 1.6s ease-in-out infinite'
      }
    },
  },
  plugins: [],
};
