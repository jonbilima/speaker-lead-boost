import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ASSET_TYPES } from "./AssetTypes";

interface AssetTypeSummaryProps {
  assetType: (typeof ASSET_TYPES)[number];
  count: number;
  onClick: () => void;
  isSelected: boolean;
}

export function AssetTypeSummary({
  assetType,
  count,
  onClick,
  isSelected,
}: AssetTypeSummaryProps) {
  const hasAssets = count > 0;
  const Icon = assetType.icon;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-4 cursor-pointer transition-all hover:shadow-md",
        hasAssets && `border-2 ${assetType.borderColor}`,
        isSelected && assetType.bgLight
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            hasAssets ? assetType.color : "bg-gray-200"
          )}
        >
          <Icon className={cn("h-5 w-5", hasAssets ? "text-white" : "text-gray-400")} />
        </div>
        <div>
          <p className="text-2xl font-bold">{count}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {assetType.label}
          </p>
        </div>
      </div>
    </Card>
  );
}
