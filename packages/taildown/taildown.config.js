
/** @type {import('./src/types').TaildownConfig} */
const taildownConfig = {
  components: {
    title: {
      base: 'text-4xl font-bold text-gray-800 dark:text-gray-100',
    },
    button: {
      base: 'px-6 py-2 rounded-lg font-semibold transition-colors',
      variants: {
        primary: 'bg-blue-600 text-white',
        secondary: 'bg-gray-200 text-gray-700',
      },
    },
    'button-hover': {
      base: 'shadow-lg transform -translate-y-px',
      variants: {
        primary: 'hover:bg-blue-700',
        secondary: 'hover:bg-gray-300',
      },
    },
  },
};

module.exports = taildownConfig;
