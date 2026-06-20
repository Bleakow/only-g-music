---
name: infra-firebase
description: "Trigger: Firebase, Firestore, Storage, Auth, Cloud Functions, reglas, deploy, infraestructura, índices, TTL, env, seguridad, FCM, push. Infraestructura Firebase para Only G."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

# Infraestructura / Firebase — Only G

## Activation Contract

Usar al tocar Firebase (Firestore, Storage, Auth, Functions), reglas de seguridad, índices, despliegue o configuración de entorno.

## Hard Rules

- **La config de Firebase es pública** (va en `.env.local`, gitignored). La **seguridad real son las reglas**, no ocultar claves. Nunca pongas secretos en el cliente.
- **La UI nunca llama a Firebase directo** → todo por `src/lib/firebase` + repos (`*-repo.ts`).
- **Reglas deny-by-default**: valida `request.auth`, ownership (`request.auth.uid == uid`) y forma (`request.resource.data`). **Sin auto-escalado de roles** desde el cliente; los roles los cambia solo Admin SDK / Functions.
- **Firestore rechaza `undefined`**: limpia los campos opcionales antes de escribir.
- **Búsqueda por prefijo**: requiere campo normalizado (`*Lower`) + **índice compuesto** (Firestore da el link al fallar). `array-contains` + rango → índice compuesto.
- **Datos efímeros**: **TTL nativo de Firestore** (campo `expiresAt`) para metadatos + **reglas de ciclo de vida de Cloud Storage** para archivos (el TTL de Firestore NO borra Storage).
- **Lógica con la app cerrada** (auto-acciones, push) → **Cloud Functions** (requiere plan **Blaze**). Push = FCM + service worker.
- **Deploy**: `firebase deploy --only firestore:rules` · `--only storage` · `--only functions`.
- **Nunca commitees** secretos ni archivos con derechos (fotos placeholder por tema legal).

## Decision Gates

| Necesito | Acción |
|----------|--------|
| Acceder a datos desde UI | Repo (`*-repo.ts`), nunca SDK directo |
| Proteger una colección | Regla con auth + ownership + forma |
| Borrar datos solos tras X tiempo | TTL Firestore + lifecycle de Storage |
| Acción con app cerrada / push | Cloud Function (Blaze) + FCM |
| Buscar por nombre | Campo `*Lower` + índice compuesto |

## Output Contract

Acceso vía repos, reglas deny-by-default con ownership y forma, sin `undefined` a Firestore, efímeros con TTL+lifecycle, secretos fuera del repo.

## References

- `../../../firestore.rules` · `../../../storage.rules`
- `../../../src/lib/firebase` · `../../../AGENTS.md`
