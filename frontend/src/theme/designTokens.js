// Design tokens for Crib - Decentralized Social Media Platform
// A minimal yet engaging design system with a "wow factor"

export const tokens = {
  // Color palette - Sunrise inspired: warm, welcoming, and energetic
  colors: {
    // Primary colors - Sunrise Orange/Coral
    primary: {
      main: '#FF6B6B', // Vibrant coral/sunrise red - main brand color
      light: '#FF8E8E',
      dark: '#E63946',
      contrastText: '#FFFFFF'
    },
    // Secondary accent color - Golden Yellow
    secondary: {
      main: '#FFD93D', // Bright golden yellow - dawn light
      light: '#FFE66D',
      dark: '#FFC107',
      contrastText: '#1F2937'
    },
    // Tertiary color - Sunrise Purple/Lavender
    tertiary: {
      main: '#A78BFA', // Soft purple for NFT-related elements (early morning sky)
      light: '#C4B5FD',
      dark: '#8B5CF6',
      contrastText: '#FFFFFF'
    },
    // Neutrals - Warm tinted grays
    grey: {
      50: '#FEF9F5',  // Very light warm beige
      100: '#FDF4EB', // Warm off-white
      200: '#FAE8D9', // Light peachy beige
      300: '#E8D5C4', // Soft tan
      400: '#B8A89A', // Warm medium gray
      500: '#8B7E74', // Warm gray
      600: '#6B5E54', // Dark warm gray
      700: '#4A403A', // Darker brown-gray
      800: '#352F2B', // Very dark warm brown
      900: '#1F1B18', // Nearly black with warmth
    },
    // Feedback - Sunrise themed
    feedback: {
      success: '#06D6A0', // Teal/mint green for success
      warning: '#FFB627', // Warm amber for warning
      error: '#E63946',   // Deep coral red for error
      info: '#4ECDC4',    // Turquoise for info
    },
    // Background - Soft warm tones
    background: {
      default: '#FEF9F5', // Very light warm background (early morning sky)
      paper: '#FFFFFF',
      dark: '#1F1B18',
    },
    // Text - Warm-tinted text colors
    text: {
      primary: '#352F2B', // Dark warm brown, not pure black for softer readability
      secondary: '#6B5E54',
      disabled: '#B8A89A',
      hint: '#B8A89A',
    },
    // Special - Sunrise-themed gradients
    special: {
      nft: 'linear-gradient(135deg, #A78BFA, #FF6B6B)', // Purple to coral gradient
      verified: '#06D6A0', // Teal for verified
      trending: 'linear-gradient(135deg, #FFD93D, #FF6B6B)', // Golden to coral sunrise
      sunrise: 'linear-gradient(135deg, #FF6B6B 0%, #FFB627 50%, #FFD93D 100%)', // Full sunrise gradient
    },
  },

  // Typography
  typography: {
    fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
    fontFamilyMono: "'SF Mono', 'Roboto Mono', monospace",
    fontWeights: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
    sizes: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem',  // 36px
      '5xl': '3rem',     // 48px
    },
  },

  // Spacing
  spacing: {
    0: '0',
    1: '0.25rem',  // 4px
    2: '0.5rem',   // 8px
    3: '0.75rem',  // 12px
    4: '1rem',     // 16px
    5: '1.25rem',  // 20px
    6: '1.5rem',   // 24px
    8: '2rem',     // 32px
    10: '2.5rem',  // 40px
    12: '3rem',    // 48px
    16: '4rem',    // 64px
    20: '5rem',    // 80px
    24: '6rem',    // 96px
    32: '8rem',    // 128px
    40: '10rem',   // 160px
    48: '12rem',   // 192px
    56: '14rem',   // 224px
    64: '16rem',   // 256px
  },

  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.125rem',    // 2px
    default: '0.25rem', // 4px
    md: '0.375rem',    // 6px
    lg: '0.5rem',      // 8px
    xl: '0.75rem',     // 12px
    '2xl': '1rem',     // 16px
    '3xl': '1.5rem',   // 24px
    full: '9999px',    // Full rounded (circles)
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    default: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    none: 'none',
  },

  // Transitions
  transitions: {
    default: '0.3s ease',
    fast: '0.15s ease',
    slow: '0.5s ease',
  },

  // Z-index
  zIndex: {
    0: 0,
    10: 10,
    20: 20,
    30: 30,
    40: 40,
    50: 50,
    auto: 'auto',
  },

  // Special effects for "wow factor" - Sunrise themed
  effects: {
    glassmorphism: {
      background: 'rgba(255, 249, 245, 0.7)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 107, 107, 0.18)',
    },
    sunriseGlow: {
      boxShadow: '0 0 10px rgba(255, 107, 107, 0.3), 0 0 20px rgba(255, 217, 61, 0.2)',
    },
    warmGlow: {
      boxShadow: '0 0 5px #FF6B6B, 0 0 10px #FFD93D, 0 0 15px rgba(255, 107, 107, 0.3)',
    },
    softShadow: {
      boxShadow: '0 10px 30px rgba(255, 107, 107, 0.08), 0 1px 8px rgba(255, 217, 61, 0.06)',
    },
    cardHover: {
      transform: 'translateY(-4px)',
      boxShadow: '0 12px 30px rgba(255, 107, 107, 0.15), 0 8px 16px rgba(255, 217, 61, 0.1)',
    },
  },

  // Animation keyframes
  keyframes: {
    fadeIn: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    slideUp: {
      from: { transform: 'translateY(10px)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 },
    },
    pulse: {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.7 },
    },
    float: {
      '0%, 100%': { transform: 'translateY(0)' },
      '50%': { transform: 'translateY(-10px)' },
    },
    shimmer: {
      '0%': { backgroundPosition: '-1000px 0' },
      '100%': { backgroundPosition: '1000px 0' },
    },
  },
};

// Convert design tokens to MUI theme
export const createThemeFromTokens = (tokens) => {
  return {
    palette: {
      mode: 'light',
      primary: tokens.colors.primary,
      secondary: tokens.colors.secondary,
      tertiary: tokens.colors.tertiary,
      grey: tokens.colors.grey,
      background: {
        default: tokens.colors.background.default,
        paper: tokens.colors.background.paper,
        dark: tokens.colors.background.dark,
      },
      text: {
        primary: tokens.colors.text.primary,
        secondary: tokens.colors.text.secondary,
        disabled: tokens.colors.text.disabled,
      },
      success: {
        main: tokens.colors.feedback.success,
      },
      warning: {
        main: tokens.colors.feedback.warning,
      },
      error: {
        main: tokens.colors.feedback.error,
      },
      info: {
        main: tokens.colors.feedback.info,
      },
    },
    typography: {
      fontFamily: tokens.typography.fontFamily,
      fontWeightLight: tokens.typography.fontWeights.light,
      fontWeightRegular: tokens.typography.fontWeights.regular,
      fontWeightMedium: tokens.typography.fontWeights.medium,
      fontWeightBold: tokens.typography.fontWeights.bold,
      h1: {
        fontWeight: tokens.typography.fontWeights.extrabold,
        fontSize: tokens.typography.sizes["5xl"],
        lineHeight: 1.2,
        letterSpacing: '-0.025em',
      },
      h2: {
        fontWeight: tokens.typography.fontWeights.bold,
        fontSize: tokens.typography.sizes["4xl"],
        lineHeight: 1.2,
        letterSpacing: '-0.025em',
      },
      h3: {
        fontWeight: tokens.typography.fontWeights.bold,
        fontSize: tokens.typography.sizes["3xl"],
        lineHeight: 1.3,
      },
      h4: {
        fontWeight: tokens.typography.fontWeights.semibold,
        fontSize: tokens.typography.sizes["2xl"],
        lineHeight: 1.4,
      },
      h5: {
        fontWeight: tokens.typography.fontWeights.semibold,
        fontSize: tokens.typography.sizes.xl,
        lineHeight: 1.5,
      },
      h6: {
        fontWeight: tokens.typography.fontWeights.semibold,
        fontSize: tokens.typography.sizes.lg,
        lineHeight: 1.5,
      },
      subtitle1: {
        fontSize: tokens.typography.sizes.lg,
        lineHeight: 1.5,
        fontWeight: tokens.typography.fontWeights.medium,
      },
      subtitle2: {
        fontSize: tokens.typography.sizes.base,
        lineHeight: 1.5,
        fontWeight: tokens.typography.fontWeights.medium,
      },
      body1: {
        fontSize: tokens.typography.sizes.base,
        lineHeight: 1.6,
      },
      body2: {
        fontSize: tokens.typography.sizes.sm,
        lineHeight: 1.6,
      },
      button: {
        fontSize: tokens.typography.sizes.base,
        fontWeight: tokens.typography.fontWeights.medium,
        lineHeight: 1.5,
        textTransform: 'none',
      },
      caption: {
        fontSize: tokens.typography.sizes.xs,
        lineHeight: 1.5,
      },
      overline: {
        fontSize: tokens.typography.sizes.xs,
        fontWeight: tokens.typography.fontWeights.semibold,
        lineHeight: 1.5,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      },
    },
    shape: {
      borderRadius: parseInt(tokens.borderRadius.lg.replace('rem', '')) * 16,
    },
    shadows: [
      'none',
      tokens.shadows.sm,
      tokens.shadows.default,
      tokens.shadows.md,
      tokens.shadows.md,
      tokens.shadows.md,
      tokens.shadows.lg,
      tokens.shadows.lg,
      tokens.shadows.lg,
      tokens.shadows.lg,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows["2xl"],
      tokens.shadows["2xl"],
      tokens.shadows["2xl"],
      tokens.shadows["2xl"],
      tokens.shadows["2xl"],
      tokens.shadows["2xl"],
      tokens.shadows["2xl"],
      tokens.shadows["2xl"],
      tokens.shadows["2xl"],
      tokens.shadows["2xl"],
    ],
    transitions: {
      easing: {
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      duration: {
        shortest: 150,
        shorter: 200,
        short: 250,
        standard: 300,
        complex: 375,
        enteringScreen: 225,
        leavingScreen: 195,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: tokens.borderRadius.xl,
            padding: `${tokens.spacing[3]} ${tokens.spacing[5]}`,
            fontWeight: tokens.typography.fontWeights.medium,
            transition: tokens.transitions.default,
            textTransform: 'none',
          },
          contained: {
            boxShadow: tokens.shadows.md,
            '&:hover': {
              boxShadow: tokens.shadows.lg,
            },
          },
          outlined: {
            borderWidth: '2px',
            '&:hover': {
              borderWidth: '2px',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: tokens.borderRadius["2xl"],
            boxShadow: tokens.shadows.md,
            transition: tokens.transitions.default,
            '&:hover': {
              boxShadow: tokens.shadows.lg,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: tokens.borderRadius.lg,
          },
          elevation1: {
            boxShadow: tokens.shadows.md,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: tokens.borderRadius.lg,
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: tokens.shadows.sm,
            backdropFilter: 'blur(10px)',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: tokens.borderRadius.full,
            fontWeight: tokens.typography.fontWeights.medium,
          },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            border: `2px solid ${tokens.colors.background.paper}`,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: tokens.borderRadius.md,
            padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
            fontSize: tokens.typography.sizes.xs,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: tokens.borderRadius.lg,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: tokens.borderRadius["2xl"],
          },
        },
      },
    },
  };
};
