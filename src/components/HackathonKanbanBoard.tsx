"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";

import { updateHackathonStatusAction } from "@/app/admin/actions";
import { HackathonCard } from "@/components/HackathonCard";
import type { HackathonRow } from "@/types/database";
import type { HackathonStatus } from "@/types/database";

type ColumnKey = "live" | "scheduled" | "completed";

const COLUMNS: { key: ColumnKey; title: string; hint: string }[] = [
  { key: "scheduled", title: "Scheduled", hint: "Upcoming" },
  { key: "live", title: "Live", hint: "In progress" },
  { key: "completed", title: "Done", hint: "Archived" },
];

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
}

function groupByStatus(
  rows: HackathonRow[],
): Record<ColumnKey, HackathonRow[]> {
  const base: Record<ColumnKey, HackathonRow[]> = {
    live: [],
    scheduled: [],
    completed: [],
  };
  for (const row of rows) {
    const k = row.status as ColumnKey;
    if (k === "live" || k === "scheduled" || k === "completed") {
      base[k].push(row);
    } else {
      base.scheduled.push(row);
    }
  }
  return base;
}

function ColumnShell({
  title,
  hint,
  count,
  isOver,
  interactive,
  droppableRef,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  isOver: boolean;
  interactive: boolean;
  droppableRef?: (node: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  return (
    <section
      ref={droppableRef ?? undefined}
      className={`flex min-h-[320px] flex-col gap-3 rounded-2xl border border-white/[0.06] bg-[#101010] p-4 transition-[box-shadow,transform] duration-200 ease-out ${
        interactive && isOver
          ? "ring-2 ring-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.06)]"
          : ""
      }`}
    >
      <div className="flex items-baseline justify-between gap-2 border-b border-white/[0.06] pb-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          <p className="text-xs text-zinc-600">{hint}</p>
        </div>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
          {count}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3">{children}</div>
    </section>
  );
}

function DroppableColumn({
  id,
  title,
  hint,
  count,
  interactive,
  children,
}: {
  id: ColumnKey;
  title: string;
  hint: string;
  count: number;
  interactive: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !interactive });

  return (
    <ColumnShell
      title={title}
      hint={hint}
      count={count}
      isOver={isOver}
      interactive={interactive}
      droppableRef={setNodeRef}
    >
      {children}
    </ColumnShell>
  );
}

function DraggableHackathonCard({
  hack,
  supabaseProjectRef,
  interactive,
}: {
  hack: HackathonRow;
  supabaseProjectRef: string | null;
  interactive: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: hack.id,
      disabled: !interactive,
      data: { hack },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px,${transform.y}px,0)`,
        zIndex: isDragging ? 40 : undefined,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        opacity: isDragging ? 0.55 : 1,
        transition: isDragging
          ? undefined
          : "opacity 180ms ease, transform 200ms ease",
      }}
      className={
        interactive
          ? "touch-none cursor-grab active:cursor-grabbing"
          : undefined
      }
      {...(interactive ? listeners : {})}
      {...(interactive ? attributes : {})}
    >
      <HackathonCard hack={hack} supabaseProjectRef={supabaseProjectRef} />
    </div>
  );
}

function StaticKanbanGrid({
  items,
  supabaseProjectRef,
}: {
  items: HackathonRow[];
  supabaseProjectRef: string | null;
}) {
  const grouped = groupByStatus(items);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {COLUMNS.map((col) => (
        <ColumnShell
          key={col.key}
          title={col.title}
          hint={col.hint}
          count={grouped[col.key].length}
          isOver={false}
          interactive={false}
        >
          {grouped[col.key].length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-zinc-600">
              No hackathons
            </p>
          ) : (
            grouped[col.key].map((h) => (
              <HackathonCard
                key={h.id}
                hack={h}
                supabaseProjectRef={supabaseProjectRef}
              />
            ))
          )}
        </ColumnShell>
      ))}
    </div>
  );
}

type Props = {
  hackathons: HackathonRow[];
  supabaseProjectRef: string | null;
  interactive: boolean;
};

export function HackathonKanbanBoard({
  hackathons,
  supabaseProjectRef,
  interactive,
}: Props) {
  const [items, setItems] = useState<HackathonRow[]>(hackathons);
  const [active, setActive] = useState<HackathonRow | null>(null);
  const hydrated = useHydrated();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const grouped = useMemo(() => groupByStatus(items), [items]);

  const onDragStart = useCallback(
    (e: DragStartEvent) => {
      const row = items.find((h) => h.id === String(e.active.id));
      setActive(row ?? null);
    },
    [items],
  );

  const onDragEnd = useCallback(
    async (e: DragEndEvent) => {
      const { active: a, over } = e;
      setActive(null);
      if (!interactive || !over) {
        return;
      }
      const newStatus = over.id as HackathonStatus;
      if (
        newStatus !== "live" &&
        newStatus !== "scheduled" &&
        newStatus !== "completed"
      ) {
        return;
      }
      const id = String(a.id);
      const prevItems = items;
      const hack = prevItems.find((h) => h.id === id);
      if (!hack || hack.status === newStatus) {
        return;
      }
      setItems((list) =>
        list.map((h) => (h.id === id ? { ...h, status: newStatus } : h)),
      );
      const res = await updateHackathonStatusAction(id, newStatus);
      if (!res.ok) {
        setItems(prevItems);
        console.error("[Kanban]", res.error);
      }
    },
    [interactive, items],
  );

  const onDragCancel = useCallback(() => {
    setActive(null);
  }, []);

  if (!interactive || !hydrated) {
    return (
      <StaticKanbanGrid
        items={items}
        supabaseProjectRef={supabaseProjectRef}
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => (
          <DroppableColumn
            key={col.key}
            id={col.key}
            title={col.title}
            hint={col.hint}
            count={grouped[col.key].length}
            interactive
          >
            {grouped[col.key].length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-zinc-600">
                No hackathons
              </p>
            ) : (
              grouped[col.key].map((h) => (
                <DraggableHackathonCard
                  key={h.id}
                  hack={h}
                  supabaseProjectRef={supabaseProjectRef}
                  interactive
                />
              ))
            )}
          </DroppableColumn>
        ))}
      </div>
      <DragOverlay
        dropAnimation={{
          duration: 220,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {active ? (
          <div className="rotate-[0.5deg] scale-[1.02] shadow-2xl ring-1 ring-white/10 transition-shadow">
            <HackathonCard
              hack={active}
              supabaseProjectRef={supabaseProjectRef}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
