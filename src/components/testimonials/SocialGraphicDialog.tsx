import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Star } from "lucide-react";
import { Testimonial } from "./TestimonialTypes";
import { supabase } from "@/integrations/supabase/client";

interface SocialGraphicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testimonial: Testimonial | null;
}

type GraphicSize = "instagram" | "twitter";

const sizes: Record<GraphicSize, { width: number; height: number; label: string }> = {
  instagram: { width: 1080, height: 1080, label: "Instagram (1080×1080)" },
  twitter: { width: 1200, height: 675, label: "Twitter/LinkedIn (1200×675)" },
};

export function SocialGraphicDialog({ open, onOpenChange, testimonial }: SocialGraphicDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<GraphicSize>("instagram");
  const [speakerName, setSpeakerName] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const loadSpeakerName = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', session.user.id)
        .single();
      
      if (data?.name) {
        setSpeakerName(data.name);
      }
    };
    
    if (open) {
      loadSpeakerName();
    }
  }, [open]);

  useEffect(() => {
    if (open && testimonial && canvasRef.current) {
      generateGraphic();
    }
  }, [open, testimonial, size, speakerName]);

  const generateGraphic = () => {
    if (!canvasRef.current || !testimonial) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = sizes[size];
    canvas.width = width;
    canvas.height = height;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#7c3aed');
    gradient.addColorStop(1, '#4f46e5');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Quote marks background
    ctx.font = `bold ${width * 0.4}px Georgia`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillText('"', width * 0.02, height * 0.45);
    ctx.fillText('"', width * 0.7, height * 0.95);

    // Main quote
    const padding = width * 0.08;
    const maxWidth = width - padding * 2;
    
    ctx.fillStyle = '#ffffff';
    ctx.font = `italic ${width * 0.04}px Georgia`;
    
    const quoteLines = wrapText(ctx, `"${testimonial.quote}"`, maxWidth);
    const lineHeight = width * 0.055;
    const quoteStartY = height * 0.3;
    
    quoteLines.forEach((line, index) => {
      ctx.fillText(line, padding, quoteStartY + index * lineHeight);
    });

    // Stars
    if (testimonial.rating) {
      const starY = quoteStartY + quoteLines.length * lineHeight + width * 0.05;
      const starSize = width * 0.03;
      ctx.font = `${starSize}px Arial`;
      const stars = '★'.repeat(testimonial.rating) + '☆'.repeat(5 - testimonial.rating);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(stars, padding, starY);
    }

    // Author info
    const authorY = height - padding - width * 0.08;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${width * 0.028}px Arial`;
    ctx.fillText(`— ${testimonial.author_name}`, padding, authorY);
    
    if (testimonial.author_title || testimonial.author_company) {
      ctx.font = `${width * 0.022}px Arial`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      const subtitle = [testimonial.author_title, testimonial.author_company]
        .filter(Boolean)
        .join(' at ');
      ctx.fillText(subtitle, padding, authorY + width * 0.035);
    }

    // Speaker branding
    if (speakerName) {
      ctx.font = `${width * 0.018}px Arial`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(speakerName, width - padding - ctx.measureText(speakerName).width, height - padding);
    }
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.slice(0, 6); // Limit to 6 lines
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = `testimonial-${size}-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    
    toast.success("Graphic downloaded!");
  };

  if (!testimonial) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Generate Social Graphic</DialogTitle>
          <DialogDescription>
            Create a shareable quote card for social media
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Size</Label>
            <Select value={size} onValueChange={(v) => setSize(v as GraphicSize)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">{sizes.instagram.label}</SelectItem>
                <SelectItem value="twitter">{sizes.twitter.label}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg overflow-hidden bg-muted flex items-center justify-center p-4">
            <canvas
              ref={canvasRef}
              style={{
                maxWidth: '100%',
                maxHeight: '400px',
                objectFit: 'contain',
              }}
            />
          </div>

          <Button onClick={handleDownload} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download Graphic
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Add toast import
import { toast } from "sonner";
