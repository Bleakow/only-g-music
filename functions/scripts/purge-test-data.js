/**
 * Purga UNA SOLA VEZ los DATOS DE PRUEBA (transaccionales) de Firestore antes de
 * pasar a uso real. NO toca perfiles de artista ni el DOC de usuarios (membresías,
 * fotos, música) — esas colecciones están en PROTECTED y el script aborta si
 * alguna apareciera por error en la lista de borrado.
 *
 * OJO con `notifications`: es una SUBcolección bajo `users/{uid}/notifications`.
 * Se borra por `collectionGroup` (solo los docs de notificación), SIN tocar el
 * doc del usuario ni sus `fcmTokens` ni su membresía.
 *
 * Uso (desde la carpeta `functions/`, con credenciales de admin):
 *   node scripts/purge-test-data.js                        → DRY-RUN (solo cuenta)
 *   node scripts/purge-test-data.js --confirm              → BORRA lo transaccional (irreversible)
 *   node scripts/purge-test-data.js --confirm --include-optional
 *        → borra también beatRequests, convenioRequests, errorLogs y las notifications
 *
 * Credenciales (Application Default Credentials), una de estas:
 *   - gcloud auth application-default login   (cuenta con acceso al proyecto), o
 *   - export GOOGLE_APPLICATION_CREDENTIALS=/ruta/service-account.json
 */
const admin = require("firebase-admin");

const PROJECT_ID = "only-g-music-745ca";

// Colecciones transaccionales de PRUEBA a borrar (recursivo → subcolecciones).
const CORE = [
  "pedidos", // compras
  "bookings", // reservas
  "daySlots", // slots de agenda reservados por compras/reservas
  "sessions", // sesiones en vivo de productor (derivadas de reservas)
  "conversations", // mensajes/chats (+ subcolección `messages`)
  "quotes", // cotizaciones
  "movimientos", // gastos (contabilidad)
  "activos", // bienes / activos fijos
  "pasivos", // pasivos (contabilidad)
  "transactions", // libro de ingresos (contabilidad)
  "payouts", // cuentas por pagar
  "beatSales", // ventas de beats (compras de beat)
  "availability", // disponibilidad de los productores
];

// Zona gris — solo se borran con --include-optional.
const OPTIONAL = [
  "beatRequests", // peticiones de beats
  "convenioRequests", // solicitudes de convenio (productor/beatmaker)
  "errorLogs", // logs de errores (basura de diagnóstico)
];

// Subcolecciones a purgar por collectionGroup (solo con --include-optional). NO
// borra el doc padre (users), solo los docs de la subcolección.
const OPTIONAL_GROUPS = ["notifications"];

// NUNCA borrar: perfiles de artista + el DOC de usuarios + config/catálogo.
const PROTECTED = new Set([
  "users", // cuentas, roles, membresías, tokens FCM (el doc en sí)
  "artistProfiles", // perfiles de artista (+ likes)
  "producers", // productores del sello (contenido)
  "sedes", // estudios (config)
  "beats", // catálogo de beats (música)
  "config", // config de la compañía (destino de pago, etc.)
  "comercialConfig", // comisiones/precios/analítica
  "datosPago", // datos de cobro de los socios
]);

async function count(ref) {
  try {
    const snap = await ref.count().get();
    return snap.data().count;
  } catch (e) {
    return `??? (${e.code || e.message})`;
  }
}

// Borra en lotes todos los docs de un collectionGroup (subcolección), sin tocar
// el doc padre. Devuelve cuántos borró.
async function purgeGroup(db, name) {
  const cg = db.collectionGroup(name);
  let deleted = 0;
  for (;;) {
    const snap = await cg.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    process.stdout.write(`\r  Borrando ${name} (subcol)… ${deleted}`);
  }
  if (deleted) process.stdout.write("\n");
  return deleted;
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const includeOptional = args.includes("--include-optional");
  const targets = includeOptional ? [...CORE, ...OPTIONAL] : [...CORE];
  const groups = includeOptional ? [...OPTIONAL_GROUPS] : [];

  // Blindaje duro: aborta si una colección protegida se coló en la lista.
  const clash = targets.filter((c) => PROTECTED.has(c));
  if (clash.length) {
    throw new Error("ABORTA: colección PROTEGIDA en la lista: " + clash.join(", "));
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
  const db = admin.firestore();

  console.log(`\nProyecto: ${PROJECT_ID}`);
  console.log(
    confirm
      ? "MODO: ⚠️  BORRADO REAL (IRREVERSIBLE)\n"
      : "MODO: DRY-RUN (solo cuenta, no borra nada)\n",
  );

  let total = 0;
  for (const name of targets) {
    if (!confirm) {
      const n = await count(db.collection(name));
      if (typeof n === "number") total += n;
      console.log(`  ${name.padEnd(18)} ${n} docs`);
    } else {
      const n = await count(db.collection(name));
      process.stdout.write(`  Borrando ${name.padEnd(18)} (${n} docs)… `);
      await db.recursiveDelete(db.collection(name));
      console.log("OK");
      if (typeof n === "number") total += n;
    }
  }

  // Subcolecciones (notifications) por collectionGroup.
  for (const name of groups) {
    if (!confirm) {
      const n = await count(db.collectionGroup(name));
      if (typeof n === "number") total += n;
      console.log(`  ${(name + " (subcol)").padEnd(18)} ${n} docs`);
    } else {
      await purgeGroup(db, name);
    }
  }

  // En dry-run sin --include-optional, muestra las opcionales para decidir.
  if (!confirm && !includeOptional) {
    console.log("\n  — opcionales (NO se borran sin --include-optional) —");
    for (const name of OPTIONAL) {
      console.log(`  ${name.padEnd(18)} ${await count(db.collection(name))} docs`);
    }
    for (const name of OPTIONAL_GROUPS) {
      console.log(
        `  ${(name + " (subcol)").padEnd(18)} ${await count(db.collectionGroup(name))} docs`,
      );
    }
  }

  console.log(
    `\n${confirm ? "Borrados" : "Se borrarían"} ~${total} docs (+ subcolecciones).`,
  );
  console.log("PRESERVADO (intacto): " + [...PROTECTED].join(", "));
  if (!confirm) console.log("\n→ Ejecuta con --confirm para BORRAR de verdad.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\nERROR:", e.message || e);
    process.exit(1);
  });
