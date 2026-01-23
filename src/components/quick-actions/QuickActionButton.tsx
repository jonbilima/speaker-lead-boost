import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionButtonProps {
  onClick: () => void;
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
  tooltip?: string;
}

export function QuickActionButton({
  onClick,
  className,
  size = "icon",
  tooltip = "Open Toolkit with context",
}: QuickActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size={size}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className={cn(
            "h-7 w-7 text-primary hover:text-primary hover:bg-primary/10",
            className
          )}
        >
          <Zap className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
