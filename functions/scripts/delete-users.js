/**
 * Borra usuarios de PRUEBA POR COMPLETO: cuenta de Firebase Auth + su doc
 * `users/{uid}` (con subcolecciones notifications/fcmTokens) + su perfil de
 * artista (si tiene, vía users/{uid}.artistSlug) + `datosPago/{uid}`.
 *
 * Se opera por UID o email EXPLÍCITOS — nunca en masa ni por apodo. Primero usa
 * `list` para ver los logins recientes e identificar a cada quién.
 *
 * Uso (desde la carpeta `functions/`, con credenciales de admin):
 *   node scripts/delete-users.js list [N]                     → lista los N logins más recientes (def. 15)
 *   node scripts/delete-users.js delete <uid|email> ...       → DRY-RUN (muestra qué borraría)
 *   node scripts/delete-users.js delete --confirm <uid|email> → BORRA de verdad (irreversible)
 *
 * Credenciales (ADC): `gcloud auth application-default login` o
 *   export GOOGLE_APPLICATION_CREDENTIALS=/ruta/service-account.json
 */
const admin = require("firebase-admin");

const PROJECT_ID = "only-g-music-745ca";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: PROJECT_ID,
});
const auth = admin.auth();
const db = admin.firestore();

async function listRecent(n) {
  const res = await auth.listUsers(1000);
  const users = res.users
    .map((u) => {
      const iso = u.metadata.lastSignInTime || u.metadata.creationTime || "";
      return {
        uid: u.uid,
        email: u.email || "(sin email)",
        name: u.displayName || "(sin nombre)",
        last: iso || "(nunca)",
        lastMs: Date.parse(iso) || 0,
      };
    })
    .sort((a, b) => b.lastMs - a.lastMs)
    .slice(0, n);

  console.log(`\nUsuarios por login más reciente (top ${n}):\n`);
  console.log(
    "  " +
      "ULTIMO LOGIN".padEnd(26) +
      "EMAIL".padEnd(30) +
      "NOMBRE".padEnd(22) +
      "UID",
  );
  for (const u of users) {
    console.log(
      "  " +
        String(u.last).padEnd(26) +
        u.email.padEnd(30) +
        u.name.padEnd(22) +
        u.uid,
    );
  }
  console.log(
    "\n→ Copia los UID (o emails) que quieras borrar y usa:\n" +
      "   node scripts/delete-users.js delete --confirm <uid|email> ...",
  );
}

async function resolveUid(idOrEmail) {
  if (idOrEmail.includes("@")) {
    try {
      return (await auth.getUserByEmail(idOrEmail)).uid;
    } catch {
      return null;
    }
  }
  return idOrEmail;
}

async function deleteUsers(ids, confirm) {
  for (const id of ids) {
    const uid = await resolveUid(id);
    if (!uid) {
      console.log(`  ⚠️  no encontrado (email sin cuenta): ${id}`);
      continue;
    }

    let email = uid;
    let name = "";
    let slug = null;
    try {
      const au = await auth.getUser(uid);
      email = au.email || uid;
      name = au.displayName || "";
    } catch {
      console.log(`  ⚠️  no existe en Auth: ${uid} (borro solo su rastro en Firestore)`);
    }
    try {
      const snap = await db.doc(`users/${uid}`).get();
      slug = snap.exists ? snap.data().artistSlug || null : null;
    } catch {
      /* sin doc de usuario */
    }

    const targets = [
      `Auth: ${email}`,
      `users/${uid} (+ notifications, fcmTokens)`,
      slug ? `artistProfiles/${slug} (+ likes)` : null,
      `datosPago/${uid}`,
    ].filter(Boolean);

    if (!confirm) {
      console.log(`\n[DRY-RUN] ${email} ${name} (${uid}) → borraría:`);
      targets.forEach((t) => console.log(`    - ${t}`));
      continue;
    }

    process.stdout.write(`\nBorrando ${email} (${uid})… `);
    if (slug) await db.recursiveDelete(db.doc(`artistProfiles/${slug}`));
    await db.recursiveDelete(db.doc(`users/${uid}`));
    await db.doc(`datosPago/${uid}`).delete().catch(() => {});
    await auth
      .deleteUser(uid)
      .catch((e) => process.stdout.write(`(auth: ${e.code || e.message}) `));
    console.log("OK");
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "list") {
    await listRecent(Number(rest[0]) || 15);
  } else if (cmd === "delete") {
    const confirm = rest.includes("--confirm");
    const ids = rest.filter((a) => a !== "--confirm");
    if (!ids.length) throw new Error("Da al menos un UID o email.");
    console.log(`\nProyecto: ${PROJECT_ID} — ${confirm ? "⚠️  BORRADO REAL" : "DRY-RUN"}`);
    await deleteUsers(ids, confirm);
    console.log(
      confirm
        ? "\nListo."
        : "\n→ DRY-RUN. Repite con --confirm para borrar de verdad.",
    );
  } else {
    console.log(
      "Uso:\n" +
        "  node scripts/delete-users.js list [N]\n" +
        "  node scripts/delete-users.js delete [--confirm] <uid|email> ...",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\nERROR:", e.message || e);
    process.exit(1);
  });
