"use client";

import { useEffect, useState } from "react";

/**
 * Champ image : aperçu, choix d'un fichier et « Retirer l'image ».
 * Envoie `${name}` (image actuelle), `${name}_file` (nouveau fichier) et `${name}_remove` ; voir imageFromForm().
 */
export function ImageField({
  name,
  label,
  current,
  currentUrl,
  accept,
}: {
  name: string;
  label: string;
  current: string | null;
  currentUrl: string | null;
  accept: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  useEffect(() => () => void (picked && URL.revokeObjectURL(picked)), [picked]);

  const shown = picked ?? (removed ? null : currentUrl);
  return (
    <div>
      <span className="mb-[5px] block font-bold text-nuit">{label}</span>
      <input type="hidden" name={name} value={current ?? ""} />
      <div className="flex items-start gap-3">
        <div className="grid size-24 flex-none place-items-center overflow-hidden rounded-xl border border-bord bg-fond">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="size-full object-contain" />
          ) : (
            <span className="px-2 text-center text-xs text-gris">{current && !removed ? current : "Aucune image"}</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            type="file"
            name={`${name}_file`}
            accept={accept}
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPicked(file ? URL.createObjectURL(file) : null);
            }}
            className="block w-full text-sm text-gris file:mr-3 file:rounded-full file:border-[1.5px] file:border-[#b9d7f5] file:bg-white file:px-3 file:py-1 file:font-extrabold file:text-bleu hover:file:bg-bleu-doux"
          />
          <p className="text-[13px] text-gris">PNG, JPEG ou WebP, 4 Mo au maximum.</p>
          {current && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={`${name}_remove`} checked={removed} onChange={(e) => setRemoved(e.target.checked)} />
              Retirer l'image
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
