import { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  className?: string;
  error?: string;
}

export const TimePickerField = ({
  id,
  label,
  value,
  onChange,
  optional = false,
  className,
  error,
}: TimePickerFieldProps) => {
  const timeInputRef = useRef<HTMLInputElement>(null);

  const handleContainerClick = () => {
    if (timeInputRef.current) {
      try {
        // Triggers the native browser clock/time selector
        timeInputRef.current.showPicker();
      } catch (err) {
        timeInputRef.current.focus();
      }
    }
  };

  return (
    <div
      className={cn("space-y-2 group", className)}
      onClick={handleContainerClick}
    >
      <Label
        htmlFor={id}
        className="cursor-pointer group-hover:text-primary transition-colors"
      >
        {label}{" "}
        {optional && (
          <span className="text-muted-foreground font-normal">(opsional)</span>
        )}
      </Label>

      <div className="relative">
        <Clock
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors pointer-events-none",
            "group-hover:text-primary"
          )}
        />
        <Input
          ref={timeInputRef}
          id={id}
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "pl-10 cursor-pointer focus-visible:ring-primary",
            error && "border-destructive focus-visible:ring-destructive"
          )}
        />
      </div>

      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
};
