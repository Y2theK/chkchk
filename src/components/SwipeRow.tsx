import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const REVEAL_WIDTH = 80;
const OPEN_THRESHOLD = 24;
const FLICK_VELOCITY = 0.45;
const FLICK_MIN_DISTANCE = 12;
const OVERSCROLL_DAMPING = 0.25;
const DIRECTION_LOCK = 8;

type SwipeRowProps = {
  children: ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
  /** Called on a plain tap. Not called after a drag, and not called while the row is open. */
  onClick?: () => void;
  className?: string;
  innerClassName?: string;
};

export function SwipeRow({
  children,
  onDelete,
  deleteLabel = "Delete",
  onClick,
  className,
  innerClassName,
}: SwipeRowProps) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const active = useRef(false);
  const suppressClick = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const locked = useRef<"x" | "y" | null>(null);
  const base = useRef(0);
  const offsetRef = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const velocity = useRef(0);

  const close = () => {
    setOpen(false);
    offsetRef.current = 0;
    setOffset(0);
  };

  const swallowClick = () => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    active.current = true;
    suppressClick.current = false;
    setDragging(true);
    locked.current = null;
    startX.current = e.clientX;
    startY.current = e.clientY;
    base.current = open ? -REVEAL_WIDTH : 0;
    lastX.current = e.clientX;
    lastT.current = e.timeStamp;
    velocity.current = 0;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!active.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (!locked.current) {
      if (Math.abs(dx) > DIRECTION_LOCK || Math.abs(dy) > DIRECTION_LOCK) {
        locked.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (locked.current === "x") e.currentTarget.setPointerCapture(e.pointerId);
      }
    }
    if (locked.current !== "x") return;

    const dt = e.timeStamp - lastT.current;
    if (dt > 0) {
      velocity.current = (e.clientX - lastX.current) / dt;
      lastX.current = e.clientX;
      lastT.current = e.timeStamp;
    }

    const raw = base.current + dx;
    const next =
      raw < -REVEAL_WIDTH
        ? -REVEAL_WIDTH + (raw + REVEAL_WIDTH) * OVERSCROLL_DAMPING
        : Math.min(0, raw);
    offsetRef.current = next;
    setOffset(next);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!active.current) return;
    active.current = false;
    setDragging(false);

    if (locked.current === "x") {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      suppressClick.current = true;
    }
    const flungLeft = velocity.current < -FLICK_VELOCITY && offsetRef.current < -FLICK_MIN_DISTANCE;
    const shouldOpen = offsetRef.current < -OPEN_THRESHOLD || flungLeft;
    setOpen(shouldOpen);
    offsetRef.current = shouldOpen ? -REVEAL_WIDTH : 0;
    setOffset(offsetRef.current);
    locked.current = null;
  };

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      <button
        type="button"
        onPointerDown={() => {
          suppressClick.current = false;
        }}
        onClick={() => {
          if (swallowClick()) return;
          close();
          onDelete();
        }}
        aria-label={deleteLabel}
        className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-expense text-white"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
        </svg>
      </button>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {
          if (swallowClick()) return;
          if (open) close();
          else onClick?.();
        }}
        style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
        className={cn(
          "relative bg-card",
          dragging ? "" : "transition-transform duration-200 ease-out",
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
