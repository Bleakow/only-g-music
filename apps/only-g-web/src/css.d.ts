// Declaración ambiental para imports de hoja de estilo "de efecto secundario"
// (p. ej. `import "./globals.css"` en el layout). El compilador nativo (tsgo /
// TS 7) es más estricto que tsc 5.9 y sin esto reporta TS2882; con esto ambos
// compiladores quedan verdes. Inofensivo para el clásico.
declare module "*.css";
