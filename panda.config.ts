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
            touchAction: 'none',
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
        },
        dragHandle: {
          className: 'drag-handle',
          base: {
            position: 'absolute',
            top: '-24px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '24px',
            height: '24px',
            bg: 'blue.600',
            color: 'white',
            rounded: 'full',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'grab',
            boxShadow: 'md',
            zIndex: 20,
            _active: { cursor: 'grabbing' }
          }
        },
        resizeGrip: {
          className: 'resize-grip',
          base: {
            position: 'absolute',
            width: '10px',
            height: '10px',
            bg: 'white',
            border: '2px solid',
            borderColor: 'blue.600',
            rounded: 'full',
            zIndex: 20,
          },
          variants: {
            position: {
              tl: { top: '-5px', left: '-5px', cursor: 'nwse-resize' },
              tr: { top: '-5px', right: '-5px', cursor: 'nesw-resize' },
              bl: { bottom: '-5px', left: '-5px', cursor: 'nesw-resize' },
              br: { bottom: '-5px', right: '-5px', cursor: 'nwse-resize' },
            }
          }
        }
      }
    },
  },

  // The output directory for your css system
  outdir: "styled-system",
});
