"use client";

/**
 * Galería bento ordenable. La reordenación usa dnd-kit (estándar del ecosistema)
 * para conseguir el efecto "burbujas": al arrastrar una foto, las demás se
 * acomodan solas con animación fluida. Soporta ratón y táctil:
 *   - Ratón: arrastra ≥6px para empezar.
 *   - Táctil: mantén pulsado ~200ms y arrastra (un swipe normal sigue haciendo
 *     scroll, por eso no bloqueamos `touch-action` en cada celda).
 * El tamaño de cada celda (bento) se aplica con CSS grid; un overlay flotante
 * muestra la foto "levantada" mientras se arrastra.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  type GalleryItem,
  GALLERY_SPAN_CLASS,
} from "@/domain/artist-profile";
import { CloseIcon, ExpandIcon, MoveIcon } from "@/components/icons";

const GRID =
  "grid auto-rows-[110px] grid-cols-2 gap-3 sm:auto-rows-[150px] sm:grid-cols-4";

function Tile({
  item,
  index,
  onResize,
  onRemove,
}: {
  item: GalleryItem;
  index: number;
  onResize: (index: number) => void;
  onRemove: (url: string) => void;
}) {
  const t = useTranslations("profileBuilder.gallery");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.url });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative cursor-grab overflow-hidden rounded-xl border border-white/10 bg-neutral-950 transition active:cursor-grabbing ${GALLERY_SPAN_CLASS[item.span]} ${
        isDragging ? "opacity-30 ring-2 ring-amethyst-300" : ""
      }`}
      {...attributes}
      {...listeners}
    >
      <Image
        src={item.url}
        alt={`Galería ${index + 1}`}
        fill
        sizes="(max-width:640px) 50vw, 25vw"
        className="pointer-events-none object-cover"
        draggable={false}
      />

      {/* Pista de "arrastrar para mover" (decorativa: NO intercepta el puntero,
          así el arrastre funciona manteniendo pulsada cualquier parte de la foto). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-[1px] text-white/90 backdrop-blur-sm"
      >
        <MoveIcon className="size-3.5" />
        {t("move")}
      </span>

      {/* Redimensionar (cicla el tamaño). stopPropagation: no inicia arrastre. */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onResize(index)}
        aria-label={t("resize")}
        className="absolute bottom-2 left-2 flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
      >
        <ExpandIcon className="size-4" />
      </button>

      {/* Quitar */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(item.url)}
        aria-label={t("remove")}
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
      >
        <CloseIcon className="size-4" />
      </button>
    </div>
  );
}

export function GalleryBento({
  items,
  onReorder,
  onResize,
  onRemove,
  addSlot,
}: {
  items: GalleryItem[];
  onReorder: (next: GalleryItem[]) => void;
  onResize: (index: number) => void;
  onRemove: (url: string) => void;
  /** Celda final para añadir fotos (no ordenable). */
  addSlot?: React.ReactNode;
}) {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const ids = items.map((i) => i.url);
  const active = items.find((i) => i.url === activeUrl) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveUrl(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveUrl(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.url === active.id);
    const to = items.findIndex((i) => i.url === over.id);
    if (from !== -1 && to !== -1) onReorder(arrayMove(items, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveUrl(null)}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={GRID}>
          {items.map((item, i) => (
            <Tile
              key={item.url}
              item={item}
              index={i}
              onResize={onResize}
              onRemove={onRemove}
            />
          ))}
          {addSlot}
        </div>
      </SortableContext>

      {/* Foto "levantada" mientras se arrastra (clon flotante). */}
      <DragOverlay>
        {active ? (
          <div className="relative h-full w-full overflow-hidden rounded-xl shadow-2xl ring-2 ring-amethyst-300">
            <Image
              src={active.url}
              alt=""
              fill
              sizes="(max-width:640px) 50vw, 25vw"
              className="object-cover"
              draggable={false}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
