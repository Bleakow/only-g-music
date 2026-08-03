---
name: ux-copy-og
description: Escribe y revisa el COPY de la UI de Only G — botones, labels, placeholders, errores, empty states, toasts y mensajes i18n (messages/es.json y en.json). Úsala al crear o editar cualquier texto que ve el usuario final. Español nativo (tú, ¿¡), bilingüe es/en, voz premium de marca y cero "AI tells".
---

# UX Copy — Only G

Guía para el **texto que ve el usuario final** de Only G (app de artistas/música
urbana, Colombia). No es teoría: son reglas para que cada botón, error y label
suene a la marca y no a plantilla de IA.

> **Distinción clave.** Esto rige el COPY DE LA UI (para artistas y fans), NO el
> tono de chat del asistente con el dueño (ese es el Jarvis sarcástico). En la UI:
> cero sarcasmo, cero ironía. Cercano, claro, con carácter.

## Idioma y registro

- **Español neutro-colombiano**, informal: trata de **tú** (no "usted"). La app
  ya lo hace: "Edita tu perfil", "Descubre a los artistas". Mantén ese registro.
- **`¿ ?` y `¡ !`** siempre (apertura incluida). La **raya (—)** en español SÍ se
  usa para incisos; no la mates como en inglés.
- **Bilingüe**: todo texto vive en `messages/es.json` **y** `en.json`. El inglés
  es copy NATURAL, no traducción literal. Mantén **paridad de claves** es↔en.
- Sé consistente con el léxico del dominio: *cotizar, beat, sencillo, perfil,
  socio, insignia, membresía*. No inventes sinónimos.

## Voz Only G

- **Premium pero cercano.** Nunca corporativo ni "startup genérica".
- **Nombra las cosas por su nombre.** "Publicar perfil" > "Comenzar tu viaje".
- **Con carácter, sin gritar.** Una chispa de personalidad en títulos/empty states;
  neutralidad total en errores y datos.
- **Concreto > vago.** Di qué pasa y qué gana el usuario, sin promesas infladas.

## Mata los "AI tells" (en español)

Prohibido el relleno y el cliché de marketing IA:

- **Clichés**: "lleva tu música al siguiente nivel", "potencia tu carrera",
  "solución integral", "experiencia única", "sin igual", "apasionado",
  "polifacético", "desde muy pequeño", "no es casualidad".
- **Relleno**: "cabe destacar", "es importante mencionar", "en el mundo de hoy",
  "sumérgete en".
- **Superlativos vacíos**: "increíble", "revolucionario", "asombroso".
- **Regla de tres decorativa** ("rápido, fácil y seguro") cuando no aporta.

Si un texto podría estar en cualquier app, reescríbelo hasta que solo sirva para
Only G.

## Patrones de microcopy

| Pieza | Regla | Ejemplo |
|---|---|---|
| **Botón** | Imperativo, **verbo + objeto**, corto. Cabe en móvil sin partirse. | `Editar perfil` · `Publicar` · `Cotizar con {name}` |
| **Placeholder** | Ejemplo/guía, no la instrucción obvia. | `Busca por nombre, género o ciudad…` |
| **Label / stat** | Sustantivo claro, 1–2 palabras. | `Seguidores` · `Visitas` · `Sencillos` |
| **Error** | **Qué pasó + qué hacer.** Nunca culpes al usuario ni uses tecnicismos. | `No pudimos guardar. Revisa tu conexión e inténtalo.` |
| **Empty state** | Reconoce el vacío + **una** acción clara. | `Aún no hay artistas. Sé el primero en publicar.` |
| **Toast / confirmación** | Breve y humano; pretérito. | `Perfil guardado.` · `Enlace copiado.` |
| **Confirmación destructiva** | Nombra la consecuencia real. | `Esto borra tu perfil. No se puede deshacer.` |

## Longitud y forma

- **Botones**: idealmente ≤ 2–3 palabras; que NO se partan en móvil.
- **Títulos de sección**: cortos, en su caja (`font-narrow`, uppercase suele ir
  bien con la marca).
- **Frases**: una idea por frase. Si necesitas coma tras coma, córtala.
- **Números**: usa el formato compacto del dominio (`formatCompact`: 48.7K).

## Accesibilidad

- Todo icono-botón lleva **`aria-label`** descriptivo (verbo + objeto), aunque el
  icono "se entienda".
- No dependas del color para el significado (estados).

## Checklist antes de dar por bueno un texto

1. ¿Registro **tú** y `¿¡` correctos?
2. ¿Sin ningún "AI tell" ni cliché de marketing?
3. ¿**Cabe** en su botón/espacio en móvil?
4. ¿Suena a **Only G** y no a app genérica?
5. ¿Está en **es.json y en.json** con la MISMA clave y un inglés natural?
6. ¿El icono-botón tiene `aria-label`?
