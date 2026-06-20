// Per-course accent identity (applied subtly: badges, dots, tints, chips, digits).
// Keyed by the course `color` field used in data.js (sky / violet / emerald).
export const courseTheme = {
  sky: { accent: '#2F6FCC', accentHover: '#255FB4', tint: '#E9F1FB', tintBorder: '#D2E2F6' },
  violet: { accent: '#7A56C9', accentHover: '#6646B4', tint: '#F2ECFB', tintBorder: '#E4D8F6' },
  emerald: { accent: '#1F9C8B', accentHover: '#178175', tint: '#E4F4F1', tintBorder: '#C8E8E1' },
}

export function getCourseTheme(color) {
  return courseTheme[color] ?? courseTheme.sky
}

// Hero / countdown gradient bar tying the three identities together.
export const courseGradientBar = 'linear-gradient(90deg, #4C57D4, #7A56C9 55%, #1F9C8B)'

// Semantic chip palettes.
export const semantic = {
  success: { fg: '#1E7A52', bg: '#E4F4ED', border: '#C8E8D8', dot: '#1E9E6A' },
  warning: { fg: '#9A6B16', bg: '#FBF3E2', border: '#F2E3C2', dot: '#C98A1E' },
  danger: { fg: '#B83232', bg: '#FBE9E9', border: '#F2D2D2', dot: '#D14343' },
  neutral: { fg: '#6A7080', bg: '#F2F4F8', border: '#E7E9F0', dot: '#A9AEBC' },
}

// Status chip for a meeting: returns inline-style-ready palette + text.
// `tone`: 'upcoming' uses the course accent; others use semantic palettes.
export function statusChipStyle(tone, text, course) {
  if (tone === 'soon') return { text, ...semantic.warning }
  if (tone === 'ended' || tone === 'draft') return { text, ...semantic.neutral }
  return { text, fg: course.accent, bg: course.tint, border: course.tintBorder, dot: course.accent }
}
