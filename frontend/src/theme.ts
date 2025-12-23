import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  globalCss: {
    body: {
      bg: { base: "bg.DEFAULT", _dark: "bg.DEFAULT" },
      color: { base: "fg.DEFAULT", _dark: "fg.DEFAULT" },
      transition: "background-color 0.2s ease, color 0.2s ease",
    },
  },
  theme: {
    tokens: {
      colors: {
        // Rustic / Paper palette
        parchment: {
          50: { value: "#fdfcf9" },
          100: { value: "#f9f6ef" },
          200: { value: "#f3ede0" },
          300: { value: "#e8dcc6" },
          400: { value: "#d4c4a8" },
          500: { value: "#bfa882" },
          600: { value: "#a08b64" },
          700: { value: "#7d6b4e" },
          800: { value: "#5c4f3a" },
          900: { value: "#3d3528" },
          950: { value: "#252017" },
        },
        ink: {
          50: { value: "#f5f4f2" },
          100: { value: "#e8e5e0" },
          200: { value: "#d1cbc1" },
          300: { value: "#b5ab9a" },
          400: { value: "#9a8d79" },
          500: { value: "#7a6f5c" },
          600: { value: "#5e5647" },
          700: { value: "#474138" },
          800: { value: "#342f29" },
          900: { value: "#231f1b" },
          950: { value: "#15130f" },
        },
        rust: {
          50: { value: "#fdf6f3" },
          100: { value: "#fae8e0" },
          200: { value: "#f5cfc0" },
          300: { value: "#ecab93" },
          400: { value: "#e08360" },
          500: { value: "#c45a34" },
          600: { value: "#a84528" },
          700: { value: "#8c3823" },
          800: { value: "#742f22" },
          900: { value: "#612a21" },
          950: { value: "#34120d" },
        },
        sage: {
          50: { value: "#f6f7f4" },
          100: { value: "#e8ebe2" },
          200: { value: "#d2d8c6" },
          300: { value: "#b3bda1" },
          400: { value: "#939f7c" },
          500: { value: "#74825e" },
          600: { value: "#5a6748" },
          700: { value: "#46503a" },
          800: { value: "#3a4232" },
          900: { value: "#32392c" },
          950: { value: "#191d15" },
        },
        sepia: {
          50: { value: "#fdfbf7" },
          100: { value: "#f7f0e3" },
          200: { value: "#efe4ce" },
          300: { value: "#e3d3b3" },
          400: { value: "#d4be91" },
          500: { value: "#c4a76f" },
          600: { value: "#a88c52" },
          700: { value: "#8b7143" },
          800: { value: "#6e5937" },
          900: { value: "#574730" },
          950: { value: "#2e2519" },
        },
      },
      fonts: {
        heading: { value: "'Crimson Pro', Georgia, serif" },
        body: { value: "'Crimson Pro', Georgia, serif" },
        mono: { value: "'JetBrains Mono', monospace" },
      },
    },
    semanticTokens: {
      colors: {
        // Background colors - warm parchment/aged paper tones
        bg: {
          DEFAULT: {
            value: { base: "#e4d5b5", _dark: "{colors.ink.950}" },
          },
          subtle: {
            value: { base: "#d9c8a0", _dark: "{colors.ink.900}" },
          },
          muted: {
            value: { base: "#cdb88a", _dark: "{colors.ink.800}" },
          },
          emphasized: {
            value: { base: "#c0a775", _dark: "{colors.ink.700}" },
          },
          panel: {
            value: { base: "#efe5cc", _dark: "{colors.ink.900}" },
          },
        },
        // Foreground/text colors
        fg: {
          DEFAULT: {
            value: { base: "{colors.ink.900}", _dark: "{colors.parchment.100}" },
          },
          muted: {
            value: { base: "{colors.ink.600}", _dark: "{colors.parchment.400}" },
          },
          subtle: {
            value: { base: "{colors.ink.400}", _dark: "{colors.parchment.500}" },
          },
          inverted: {
            value: { base: "{colors.parchment.100}", _dark: "{colors.ink.900}" },
          },
        },
        // Border colors
        border: {
          DEFAULT: {
            value: { base: "{colors.parchment.400}", _dark: "{colors.ink.700}" },
          },
          muted: {
            value: { base: "{colors.parchment.300}", _dark: "{colors.ink.800}" },
          },
          strong: {
            value: { base: "{colors.sepia.400}", _dark: "{colors.sepia.600}" },
          },
        },
        // Accent colors
        accent: {
          DEFAULT: {
            value: { base: "{colors.rust.600}", _dark: "{colors.rust.500}" },
          },
          muted: {
            value: { base: "{colors.rust.100}", _dark: "{colors.rust.900}" },
          },
          fg: {
            value: { base: "{colors.rust.700}", _dark: "{colors.rust.400}" },
          },
          emphasis: {
            value: { base: "{colors.rust.500}", _dark: "{colors.rust.400}" },
          },
        },
        // Success/positive (sage green)
        success: {
          DEFAULT: {
            value: { base: "{colors.sage.600}", _dark: "{colors.sage.500}" },
          },
          muted: {
            value: { base: "{colors.sage.100}", _dark: "{colors.sage.900}" },
          },
          fg: {
            value: { base: "{colors.sage.700}", _dark: "{colors.sage.400}" },
          },
        },
        // Error/negative (deeper rust)
        error: {
          DEFAULT: {
            value: { base: "{colors.rust.700}", _dark: "{colors.rust.500}" },
          },
          muted: {
            value: { base: "{colors.rust.100}", _dark: "{colors.rust.950}" },
          },
          fg: {
            value: { base: "{colors.rust.800}", _dark: "{colors.rust.400}" },
          },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
