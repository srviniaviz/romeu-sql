import { useEffect, useState } from "react";
import catAnimation from "@/assets/cat_animation.png";
import { cn } from "@/lib/utils";

const FRAME_COUNT = 8;
const FRAME_DURATION_MS = 260;
const FRAME_WIDTH = 64;
const FRAME_HEIGHT = 72.03827751196172;

export function StartupAnimation({ onComplete }: { onComplete: () => void }) {
  const [frame, setFrame] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const interval = reducedMotion
      ? undefined
      : window.setInterval(() => {
          setFrame((current) => {
            if (current >= FRAME_COUNT - 1) return current;
            return current + 1;
          });
        }, FRAME_DURATION_MS);
    const leaveAfter = reducedMotion ? 350 : FRAME_DURATION_MS * (FRAME_COUNT - 1) + 420;
    const leaveTimer = window.setTimeout(() => setLeaving(true), leaveAfter);
    const completeTimer = window.setTimeout(onComplete, leaveAfter + 220);

    return () => {
      if (interval !== undefined) window.clearInterval(interval);
      window.clearTimeout(leaveTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const column = frame % 4;
  const row = Math.floor(frame / 4);

  return (
    <div
      role="status"
      aria-label="Starting Romeu SQL"
      className={cn(
        "pointer-events-none fixed bottom-5 right-5 z-[100] transition-opacity duration-200",
        leaving && "opacity-0",
      )}
    >
      <div
        className="overflow-hidden"
        aria-hidden="true"
        style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT }}
      >
        <img
          src={catAnimation}
          alt=""
          draggable={false}
          className="pointer-events-none max-w-none select-none"
          style={{
            width: `${FRAME_WIDTH * 4}px`,
            height: `${FRAME_HEIGHT * 2}px`,
            transform: `translate(${-column * FRAME_WIDTH}px, ${-row * FRAME_HEIGHT}px)`,
          }}
        />
      </div>
    </div>
  );
}
