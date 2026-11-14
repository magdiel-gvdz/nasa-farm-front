// Ajustes compartidos (dataviz: ejes y cuadrícula recesivos, marcas delgadas).
export const AXIS = {
  tick: { fill: 'var(--muted)', fontSize: 12 },
  axisLine: { stroke: 'var(--axis)' },
  tickLine: false as const,
}
export const GRID = { stroke: 'var(--grid)', vertical: false, strokeDasharray: undefined }
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0]
