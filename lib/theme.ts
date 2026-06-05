export const colors = {
  brand: {
    dark: '#106B4F',
    accent: '#34C26A',
    darker: '#052419',
  },
  wordmark: {
    text: '#004B2D',
    dot: '#00A651',
  },
  gradient: {
    splash: ['#052419', '#106B4F', '#052419'] as const,
  },
  alpha: {
    accent10: 'rgba(52, 194, 106, 0.1)',
    accent20: 'rgba(52, 194, 106, 0.2)',
    accent30: 'rgba(52, 194, 106, 0.3)',
    dark10: 'rgba(16, 107, 79, 0.1)',
    dark20: 'rgba(16, 107, 79, 0.2)',
  },
} as const;
