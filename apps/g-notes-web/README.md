# G Notes — Web

Escritor inteligente para compositores (app hermana de Only G Music).

> La IA no reemplaza al artista. La IA potencia la creatividad del artista.

## Estado: M1 — App viva (local-first)

Cuaderno booteable y on-brand. Sin login ni Firebase: abrir y escribir de
inmediato, con autosave a `localStorage`. Contadores en vivo (versos, palabras,
sílabas) y sílabas de la línea actual.

```bash
pnpm --filter g-notes-web dev     # http://localhost:3000
pnpm --filter g-notes-web build
```

## Roadmap

- **M1 · App viva** ✅ cuaderno local, escribir ya, sin fricción.
- **M2 · Editor de verdad** — editor rich line-based (secciones, gutter de
  sílabas, autosave robusto). _Pendiente: decisión de tech del editor._
- **M3 · Herramientas deterministas** — sílabas con sinalefa, métrica,
  consistencia, estructura.
- **M4 · `@only-g/ai-engine` + autocompletado** — servicio Claude (streaming),
  ghost-text tipo Copilot; `@only-g/ai-services` como cliente.
- **M5 · Panel contextual** — rimas, frases similares, metáforas, expansión.
- **M6 · Identidad compartida** — `@only-g/database`+`auth`, login, sync
  Firestore, memoria creativa.
- **M7 · Membresía "acceso G Notes"** — `PagoConcepto` + gating.
- **M8 · `@only-g/ui`** — extraer tokens/glass (hoy inline en `globals.css`).
- **M9 · `g-notes-mobile`**.
