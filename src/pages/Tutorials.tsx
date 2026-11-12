import { useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, PlayCircle } from "lucide-react";

/* How-to videos and the Quick Start Guide. The files are static assets in
 * public/tutorials (built in ~/nextmic-tutorials from the real app with demo
 * data); the service worker does not precache .mp4 or .pdf, so they stream
 * on demand. */

const BASE = "/tutorials";

const TUTORIALS = [
  { title: "Getting in", length: "1:25", summary: "Set your password, use the 6-digit code if a link misbehaves, and sign in after that." },
  { title: "Set up your profile", length: "1:27", summary: "Bio, topics, audiences and fees. Your profile decides which gigs you see and how they score." },
  { title: "Find your gigs", length: "1:19", summary: "Read the match score, search and filter, use Smart Lists, save or pass, and pitch closed calls for next year." },
  { title: "Work your pipeline", length: "1:24", summary: "Move gigs through each stage, apply with an AI-written pitch, and let follow-up reminders keep you on track." },
  { title: "Send a speaker package", length: "1:09", summary: "One private page with your materials, the contract and your tech rider, and tracking when the organizer opens it." },
  { title: "From yes to paid", length: "1:02", summary: "Bill a deposit at contract signing, mark it paid, send the balance, and watch your year's revenue." },
  { title: "Help and your membership", length: "0:33", summary: "Contact support, replay the guided tour, and manage your membership." },
];

const Tutorials = () => {
  const grid = useRef<HTMLDivElement>(null);

  // One video at a time: starting one pauses the rest.
  const handlePlay = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    grid.current?.querySelectorAll("video").forEach((v) => {
      if (v !== e.currentTarget) v.pause();
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <PlayCircle className="h-6 w-6 text-primary" />
              Tutorials
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">
              Seven short videos, from your first sign-in to getting paid. Watch them in order, or
              jump to the one you need.
            </p>
          </div>
          <Button asChild variant="outline">
            <a href={`${BASE}/nextmic-quick-start-guide.pdf`} download="NextMIC Quick Start Guide.pdf">
              <Download className="h-4 w-4 mr-2" />
              Quick Start Guide (PDF)
            </a>
          </Button>
        </div>

        <div ref={grid} className="grid gap-6 md:grid-cols-2">
          {TUTORIALS.map((t, i) => (
            <Card key={t.title} className="overflow-hidden">
              <video
                className="w-full aspect-video bg-black"
                controls
                playsInline
                preload="none"
                poster={`${BASE}/howto-${i + 1}.jpg`}
                src={`${BASE}/howto-${i + 1}.mp4`}
                aria-label={`Video ${i + 1}: ${t.title}`}
                onPlay={handlePlay}
              />
              <CardContent className="p-4 space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-primary tabular-nums">{i + 1}</span>
                  <h2 className="font-semibold text-foreground">{t.title}</h2>
                  <span className="ml-auto text-sm text-muted-foreground tabular-nums">{t.length}</span>
                </div>
                <p className="text-sm text-muted-foreground">{t.summary}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          Still stuck? Press <span className="font-medium text-foreground">Support</span> at the
          bottom of the sidebar, or email support@nextmic.ai.
        </p>
      </div>
    </AppLayout>
  );
};

export default Tutorials;
