import '@testing-library/jest-dom/vitest'

window.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 0)
window.cancelAnimationFrame = id => window.clearTimeout(id)
