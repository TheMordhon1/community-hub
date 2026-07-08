import React, { useEffect, useState } from "react";

interface BracketConnectorProps {
  sourceId: string;
  targetId: string;
  containerEl: HTMLDivElement | null;
  isWinner: boolean;
}

export function BracketConnector({
  sourceId,
  targetId,
  containerEl,
  isWinner,
}: BracketConnectorProps) {
  const [path, setPath] = useState<string>("");

  useEffect(() => {
    if (!containerEl) return;

    const updatePath = () => {
      const sourceEl = containerEl.querySelector(`#match-card-${sourceId}`);
      const targetEl = containerEl.querySelector(`#match-card-${targetId}`);

      if (sourceEl && targetEl) {
        const containerRect = containerEl.getBoundingClientRect();
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        const x1 = sourceRect.right - containerRect.left;
        const y1 = sourceRect.top - containerRect.top + sourceRect.height / 2;

        const x2 = targetRect.left - containerRect.left;
        const y2 = targetRect.top - containerRect.top + targetRect.height / 2;

        const x_mid = x1 + (x2 - x1) / 2;
        setPath(`M ${x1} ${y1} H ${x_mid} V ${y2} H ${x2}`);
      }
    };

    updatePath();
    window.addEventListener("resize", updatePath);
    const timer = setTimeout(updatePath, 200);

    return () => {
      window.removeEventListener("resize", updatePath);
      clearTimeout(timer);
    };
  }, [sourceId, targetId, containerEl]);

  if (!path) return null;

  return (
    <path
      d={path}
      fill="none"
      strokeWidth={2}
      className={
        isWinner
          ? "stroke-primary/80 dark:stroke-primary/60 transition-all duration-300 drop-shadow-[0_0_3px_rgba(var(--primary),0.3)]"
          : "stroke-muted-foreground/30 dark:stroke-muted-foreground/20 transition-all duration-300"
      }
    />
  );
}
