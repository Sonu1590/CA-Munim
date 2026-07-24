import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        "mobile-heading": ['"Caprasimo"', 'serif'],
        "mobile-body": ['"Figtree"', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        whatsapp: {
          DEFAULT: "hsl(var(--whatsapp))",
          foreground: "hsl(var(--whatsapp-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Mobile-only "Organic" theme tokens — additive, see src/index.css.
        mobile: {
          bg: "var(--mobile-color-bg)",
          surface: "var(--mobile-color-surface)",
          text: "var(--mobile-color-text)",
          divider: "var(--mobile-color-divider)",
          accent: {
            DEFAULT: "var(--mobile-color-accent)",
            100: "var(--mobile-color-accent-100)",
            200: "var(--mobile-color-accent-200)",
            600: "var(--mobile-color-accent-600)",
            700: "var(--mobile-color-accent-700)",
            800: "var(--mobile-color-accent-800)",
          },
          "accent-2": {
            DEFAULT: "var(--mobile-color-accent-2)",
            100: "var(--mobile-color-accent-2-100)",
            200: "var(--mobile-color-accent-2-200)",
            800: "var(--mobile-color-accent-2-800)",
            900: "var(--mobile-color-accent-2-900)",
          },
          neutral: {
            100: "var(--mobile-color-neutral-100)",
            200: "var(--mobile-color-neutral-200)",
            300: "var(--mobile-color-neutral-300)",
            400: "var(--mobile-color-neutral-400)",
            500: "var(--mobile-color-neutral-500)",
            600: "var(--mobile-color-neutral-600)",
            700: "var(--mobile-color-neutral-700)",
            900: "var(--mobile-color-neutral-900)",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "mobile-sm": "8px",
        "mobile-md": "16px",
        "mobile-lg": "28px",
      },
      boxShadow: {
        "mobile-sm": "0 1px 2px rgba(46,43,37,0.14)",
        "mobile-md": "0 3px 10px rgba(46,43,37,0.16)",
        "mobile-lg": "0 12px 32px rgba(46,43,37,0.22)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
