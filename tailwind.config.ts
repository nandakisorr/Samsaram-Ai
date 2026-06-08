/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'hms-primary': '#2563EB',   // blue
        'hms-on-primary': '#FFFFFF',
        'hms-success': '#10B981',   // green
        'hms-on-success': '#FFFFFF',
        'hms-bg': '#F8FAFC',        // slate-50
        'hms-text': '#1E293B',      // slate-800
        'hms-muted': '#64748B',     // slate-500
        'hms-border': '#E2E8F0',    // slate-200
      },
    },
  },
  plugins: [],
}