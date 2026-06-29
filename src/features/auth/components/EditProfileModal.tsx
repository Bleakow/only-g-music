"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GlassModal } from "@/components/ui/GlassModal";
import { GlassButton } from "@/components/ui/GlassButton";
import { PhotoUpload } from "@/components/ui/PhotoUpload";
import { useAuth } from "./AuthProvider";
import { updateUserProfile } from "../lib/user-repo";
import { updateAuthProfile } from "../lib/auth-actions";

/**
 * Edición del perfil de cuenta: nombre + avatar. Guarda en Firestore
 * (`users/{uid}`, sin tocar `roles`) y sincroniza el perfil de Firebase Auth,
 * luego refresca el contexto. El email NO se edita aquí (cambiarlo es otro flujo
 * de auth con reverificación).
 */
export function EditProfileModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations();
  const { user, account, refreshAccount } = useAuth();
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sembrar el formulario con los datos actuales cada vez que se abre.
  useEffect(() => {
    if (!open) return;
    setName(account?.displayName ?? user?.displayName ?? "");
    setPhoto(account?.photoURL ?? user?.photoURL ?? "");
    setError(null);
  }, [open, account, user]);

  async function onSave() {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("account.nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateUserProfile(user.uid, { displayName: trimmed, photoURL: photo });
      await updateAuthProfile({ displayName: trimmed, photoURL: photo });
      await refreshAccount();
      onClose();
    } catch (e) {
      console.error("[edit-profile]:", e);
      setError(t("account.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassModal
      open={open}
      onClose={() => !saving && onClose()}
      title={t("account.edit")}
    >
      <div className="space-y-5">
        <div className="mx-auto w-32">
          <PhotoUpload
            value={photo}
            onChange={setPhoto}
            aspect="aspect-square"
            emptyLabel={t("account.photoLabel")}
            ariaLabel={t("account.photoLabel")}
            onError={(m) => setError(m)}
          />
        </div>

        <label className="block">
          <span className="text-silver-300 text-xs font-semibold tracking-[1px] uppercase">
            {t("account.nameLabel")}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("account.namePlaceholder")}
            className="mt-1.5 w-full rounded-lg bg-white/[0.06] px-3 py-2 text-white ring-1 ring-white/20 transition outline-none ring-inset focus:ring-white/50"
          />
        </label>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <GlassButton onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </GlassButton>
          <GlassButton onClick={onSave} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}
