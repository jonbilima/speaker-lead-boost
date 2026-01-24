import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ChevronRight, X, Sparkles, PartyPopper } from "lucide-react";
import { useOnboarding, ONBOARDING_STEPS } from "@/hooks/useOnboarding";

export function OnboardingChecklist() {
  const navigate = useNavigate();
  const {
    shouldShow,
    stepsStatus,
    completedCount,
    totalSteps,
    isComplete,
    dismissOnboarding,
  } = useOnboarding();

  if (!shouldShow) return null;

  const progressPercent = (completedCount / totalSteps) * 100;

  if (isComplete) {
    return (
      <Card className="bg-gradient-to-r from-accent/10 to-primary/10 border-accent/20">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-accent to-primary flex items-center justify-center">
              <PartyPopper className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">You're all set!</h3>
              <p className="text-muted-foreground">
                Start finding your next speaking gig
              </p>
            </div>
            <Button onClick={() => navigate("/find")} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Find Opportunities
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-accent/30 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div>
              <CardTitle className="text-lg">Get Started with nextmic</CardTitle>
              <CardDescription>
                Complete these steps to unlock your full potential
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={dismissOnboarding}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {completedCount} of {totalSteps} steps complete
            </span>
            <span className="font-medium text-accent">{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {ONBOARDING_STEPS.map((step) => {
            const isCompleted = stepsStatus[step.id];
            
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isCompleted
                    ? "bg-accent/5"
                    : "hover:bg-muted/50 cursor-pointer"
                }`}
                onClick={() => !isCompleted && navigate(step.route)}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${isCompleted ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {step.title}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {step.description}
                  </p>
                </div>
                {!isCompleted && (
                  <Button variant="ghost" size="sm" className="shrink-0 gap-1">
                    {step.action}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t flex justify-center">
          <Button variant="link" className="text-muted-foreground text-sm" onClick={dismissOnboarding}>
            Skip tutorial
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}