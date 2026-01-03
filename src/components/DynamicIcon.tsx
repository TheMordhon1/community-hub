import { icons, LucideProps, CircleHelp } from "lucide-react";

interface DynamicIconProps extends LucideProps {
  name: string;
}

export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const LucideIcon = icons[name as keyof typeof icons];

  if (!LucideIcon) {
    return <CircleHelp {...props} />;
  }

  return <LucideIcon {...props} />;
}
