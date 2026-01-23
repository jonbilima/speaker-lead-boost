import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Target, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RevenueGoalHeaderProps {
  goal: number;
  goalYear: number;
  currentRevenue: number;
  userId: string;
  onGoalUpdate: (newGoal: number) => void;
}

export function RevenueGoalHeader({
  goal,
  goalYear,
  currentRevenue,
  userId,
  onGoalUpdate,
}: RevenueGoalHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(goal.toString());
  const [saving, setSaving] = useState(false);

  const progressPercent = goal > 0 ? Math.min((currentRevenue / goal) * 100, 100) : 0;
  const remaining = Math.max(goal - currentRevenue, 0);

  const handleSave = async () => {
    const newGoal = parseFloat(editValue);
    if (isNaN(newGoal) || newGoal <= 0) {
      toast.error("Please enter a valid goal amount");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          annual_revenue_goal: newGoal,
          revenue_goal_year: new Date().getFullYear(),
        })
        .eq("id", userId);

      if (error) throw error;

      onGoalUpdate(newGoal);
      setIsEditing(false);
      toast.success("Revenue goal updated!");
    } catch (error) {
      console.error("Error updating goal:", error);
      toast.error("Failed to update goal");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getProgressColor = () => {
    if (progressPercent >= 100) return "bg-green-500";
    if (progressPercent >= 75) return "bg-emerald-500";
    if (progressPercent >= 50) return "bg-yellow-500";
    if (progressPercent >= 25) return "bg-orange-500";
    return "bg-violet-500";
  };

  return (
    <Card className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Target className="h-6 w-6 text-violet-600" />
            </div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <span className="font-medium">{goalYear} Goal: $</span>
                <Input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-32 h-8"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSave}
                  disabled={saving}
                  className="h-8 w-8 p-0"
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditValue(goal.toString());
                    setIsEditing(false);
                  }}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 hover:bg-violet-100 rounded-lg px-2 py-1 transition-colors group"
              >
                <span className="text-xl font-bold text-foreground">
                  {goalYear} Goal: {formatCurrency(goal)}
                </span>
                <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-violet-700">
              {progressPercent.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(remaining)} remaining
            </div>
          </div>
        </div>

        <div className="relative">
          <Progress
            value={progressPercent}
            className="h-4 bg-violet-100"
          />
          <div
            className={`absolute top-0 left-0 h-4 rounded-full transition-all ${getProgressColor()}`}
            style={{ width: `${progressPercent}%` }}
          />
          {/* Milestone markers */}
          {[25, 50, 75, 100].map((milestone) => (
            <div
              key={milestone}
              className="absolute top-0 h-4 w-0.5 bg-white/50"
              style={{ left: `${milestone}%` }}
            />
          ))}
        </div>

        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{formatCurrency(0)}</span>
          <span>{formatCurrency(goal * 0.25)}</span>
          <span>{formatCurrency(goal * 0.5)}</span>
          <span>{formatCurrency(goal * 0.75)}</span>
          <span>{formatCurrency(goal)}</span>
        </div>

        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-violet-200">
          <div className="text-center">
            <div className="text-lg font-semibold text-green-600">
              {formatCurrency(currentRevenue)}
            </div>
            <div className="text-xs text-muted-foreground">Confirmed Revenue</div>
          </div>
          <div className="w-px h-8 bg-violet-200" />
          <div className="text-center">
            <div className="text-lg font-semibold text-violet-600">
              {formatCurrency(goal)}
            </div>
            <div className="text-xs text-muted-foreground">Annual Goal</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
