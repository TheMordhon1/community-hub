import React from "react";
import { getTeamFlag, getFlagImgUrl } from "@/lib/countries";

interface TeamFlagProps {
  team?: { name: string; logo_url?: string | null } | null;
  className?: string;
  fallbackSize?: string;
}

export function TeamFlag({ 
  team, 
  className = "w-5 h-3.5 object-cover rounded shadow-sm inline-block select-none border border-border/20 shrink-0", 
  fallbackSize = "text-xl" 
}: TeamFlagProps) {
  const flag = getTeamFlag(team);
  if (!flag) return null;

  const isUrl = flag.includes("/");
  
  if (isUrl) {
    return (
      <img
        src={flag}
        alt={team?.name || "Flag"}
        className={className}
        loading="lazy"
      />
    );
  }

  const imgUrl = getFlagImgUrl(flag);
  if (imgUrl) {
    return (
      <img
        src={imgUrl}
        alt={team?.name || "Flag"}
        className={className}
        loading="lazy"
      />
    );
  }

  // Fallback to emoji if unable to parse
  return (
    <span className={`${fallbackSize} leading-none select-none shrink-0`} title="Bendera Tim">
      {flag}
    </span>
  );
}
