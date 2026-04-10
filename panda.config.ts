import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  // Whether to use css reset
  preflight: true,

  // Where to look for your css declarations
  include: ["./src/**/*.{js,jsx,ts,tsx}", "./pages/**/*.{js,jsx,ts,tsx}"],

  // Files to exclude
  exclude: [],

  // Useful for theme customization
  theme: {
    extend: {
      recipes: {
        fieldOverlay: {
          className: 'field-overlay',
          base: {
            position: 'absolute',
            border: '2px solid',
            borderColor: 'blue.500',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            cursor: 'move',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 'bold',
            color: 'blue.700',
            userSelect: 'none',
            _hover: {
              borderColor: 'blue.600',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
            },
            _selected: {
              borderColor: 'red.500',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              outline: '2px solid red',
              zIndex: 10,
            },
          },
          variants: {
            selected: {
              true: {
                borderColor: 'red.500',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                outline: '2px solid red',
                zIndex: 10,
              }
            }
          }
        }
      }
    },
  },

  // The output directory for your css system
  outdir: "styled-system",
});
