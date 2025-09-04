//   keyframes preset
//  default theme reference

export const keyframes = {
  spin: {
    to: {
      transform: 'rotate(360deg)',
    },
  },
  ping: {
    "75%": {
      transform: 'scale(2)',
      opacity: '0',
    },
    "100%": {
      transform: 'scale(2)',
      opacity: '0',
    },
  },
  pulse: {
    "50%": {
      opacity: '0.5',
    },
  },
  bounce: {
    "0%": {
      transform: 'translateY(-25%)',
      'animation-timing-function': 'cubic-bezier(0.8,0,1,1)',
    },
    "100%": {
      transform: 'none',
      'animation-timing-function': 'cubic-bezier(0,0,0.2,1)',
    },
  },
}; 