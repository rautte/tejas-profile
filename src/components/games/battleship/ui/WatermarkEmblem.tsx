import React from "react";
import type { Role } from "lib/mp";

export const WatermarkEmblem: React.FC<{
  role: Role;
  Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  size?: number | string;
  opacity?: number;
  ring?: boolean;
}> = ({ role, Icon, size = 520, opacity = 1, ring = true }) => {
  const bubbleBgClass = role === "host" ? "bg-blue-600/10" : "bg-emerald-600/10";
  const iconColorClass =
    role === "host" ? "text-blue-700 dark:text-blue-300" : "text-emerald-600 dark:text-emerald-300";
  const ringClass = ring ? "ring-1 ring-black/10 dark:ring-white/10" : "";
  const dim = typeof size === "number" ? `${size}px` : size;

  return (
    <div className="relative pointer-events-none" style={{ width: dim, height: dim, opacity }}>
      <div className={`absolute inset-0 rounded-full ${bubbleBgClass} ${ringClass}`} aria-hidden />
      <Icon
        className={`absolute ${iconColorClass}`}
        style={{ top: 12, right: 12, bottom: 12, left: 12, position: "absolute" }}
        aria-hidden="true"
      />
    </div>
  );
};
