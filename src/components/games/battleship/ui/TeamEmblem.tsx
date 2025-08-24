import React from "react";
import type { Role } from "lib/mp";

export const TeamEmblem: React.FC<{
  role: Role;
  Icon?: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  size?: number;
  title?: string;
}> = ({ role, Icon, size = 40, title }) => {
  const bubble =
    role === "host"
      ? "bg-blue-600/10 text-blue-700 dark:text-blue-300"
      : "bg-emerald-600/10 text-emerald-600 dark:text-emerald-300";
  const iconSize = Math.max(10, size - 4);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/10 ${bubble}`}
      style={{ width: size, height: size }}
      aria-label={title ?? (role === "host" ? "Host emblem" : "Guest emblem")}
      title={title ?? (role === "host" ? "Host emblem" : "Guest emblem")}
    >
      {Icon ? <Icon width={iconSize} height={iconSize} aria-hidden="true" /> : null}
    </span>
  );
};
