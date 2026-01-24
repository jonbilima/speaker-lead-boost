import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  Pause,
  RotateCcw,
  Mic,
  MicOff,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

interface PracticeModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  script: string;
  targetDuration: number;
}

export function PracticeModeDialog({
  open,
  onOpenChange,
  script,
  targetDuration,
}: PracticeModeDialogProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Clean script for teleprompter display
  const cleanScript = script
    .replace(/\[PAUSE\]/gi, "\n\n⏸️ PAUSE ⏸️\n\n")
    .replace(/\[INTERACTION[^\]]*\]/gi, "\n\n🎤 INTERACT WITH AUDIENCE 🎤\n\n")
    .split("---")
    .join("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n");

  const wordCount = script.split(/\s+/).filter(Boolean).length;
  const targetSeconds = targetDuration * 60;
  const expectedSecondsPerWord = targetSeconds / wordCount;
  const currentWPM = elapsedSeconds > 0 ? (wordCount / elapsedSeconds) * 60 : 0;

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
        
        // Auto-scroll
        if (scrollRef.current) {
          const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
          if (scrollElement) {
            const scrollHeight = scrollElement.scrollHeight;
            const viewportHeight = scrollElement.clientHeight;
            const progress = elapsedSeconds / targetSeconds;
            const targetScroll = (scrollHeight - viewportHeight) * Math.min(progress * scrollSpeed, 1);
            scrollElement.scrollTop = targetScroll;
          }
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, scrollSpeed, targetSeconds]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getPaceStatus = () => {
    if (elapsedSeconds < 30) return { label: "Starting...", color: "bg-muted" };
    
    const progress = elapsedSeconds / targetSeconds;
    const expectedProgress = 0.5; // Rough estimate
    
    if (progress < expectedProgress * 0.8) {
      return { label: "Too fast", color: "bg-red-500/10 text-red-600" };
    } else if (progress > expectedProgress * 1.2) {
      return { label: "Too slow", color: "bg-yellow-500/10 text-yellow-600" };
    }
    return { label: "On pace", color: "bg-green-500/10 text-green-600" };
  };

  const handleReset = () => {
    setIsPlaying(false);
    setElapsedSeconds(0);
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = 0;
      }
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const url = URL.createObjectURL(audioBlob);
          
          // Create download link
          const a = document.createElement("a");
          a.href = url;
          a.download = `practice-recording-${new Date().toISOString()}.webm`;
          a.click();
          
          // Clean up
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error("Failed to start recording:", error);
      }
    }
  };

  const paceStatus = getPaceStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col bg-black text-white">
        <DialogHeader className="border-b border-white/10 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white">Practice Mode</DialogTitle>
            <div className="flex items-center gap-4">
              <Badge className={paceStatus.color}>{paceStatus.label}</Badge>
              <span className="text-2xl font-mono">
                {formatTime(elapsedSeconds)} / {formatTime(targetSeconds)}
              </span>
            </div>
          </div>
          <Progress
            value={(elapsedSeconds / targetSeconds) * 100}
            className="h-1 mt-2"
          />
        </DialogHeader>

        <ScrollArea className="flex-1 my-4" ref={scrollRef}>
          <div className="px-8 py-4">
            <pre className="text-3xl leading-relaxed font-sans whitespace-pre-wrap text-white/90">
              {cleanScript}
            </pre>
          </div>
        </ScrollArea>

        <div className="border-t border-white/10 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setScrollSpeed(Math.max(0.5, scrollSpeed - 0.25))}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <span className="text-sm text-white/60 min-w-[80px] text-center">
              Speed: {scrollSpeed}x
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setScrollSpeed(Math.min(2, scrollSpeed + 0.25))}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={handleReset}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            <Button
              size="lg"
              onClick={() => setIsPlaying(!isPlaying)}
              className="min-w-[120px]"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-5 w-5 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Start
                </>
              )}
            </Button>

            <Button
              variant={isRecording ? "destructive" : "outline"}
              size="icon"
              onClick={toggleRecording}
              className={isRecording ? "" : "border-white/20 text-white hover:bg-white/10"}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          </div>

          <div className="text-sm text-white/60 min-w-[100px] text-right">
            {wordCount} words
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
