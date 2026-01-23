import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  MoreHorizontal, Trash2, ExternalLink, Linkedin, Globe, 
  PlusCircle, Edit2 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WatchedSpeaker } from "./MarketWatchTypes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WatchedSpeakerCardProps {
  speaker: WatchedSpeaker;
  bookingsCount: number;
  onUpdate: () => void;
  onLogBooking: () => void;
}

export function WatchedSpeakerCard({ 
  speaker, 
  bookingsCount, 
  onUpdate, 
  onLogBooking 
}: WatchedSpeakerCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const toggleActive = async () => {
    setUpdating(true);
    const { error } = await supabase
      .from("watched_speakers")
      .update({ is_active: !speaker.is_active })
      .eq("id", speaker.id);

    setUpdating(false);

    if (error) {
      toast.error("Failed to update speaker");
    } else {
      onUpdate();
    }
  };

  const handleDelete = async () => {
    const { error } = await supabase
      .from("watched_speakers")
      .delete()
      .eq("id", speaker.id);

    if (error) {
      toast.error("Failed to delete speaker");
    } else {
      toast.success("Speaker removed from watch list");
      onUpdate();
    }
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <Card className={`p-4 ${!speaker.is_active ? "opacity-60" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium truncate">{speaker.watched_name}</h4>
              {!speaker.is_active && (
                <Badge variant="outline" className="text-xs">Paused</Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-1">
              {speaker.watched_linkedin_url && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => window.open(speaker.watched_linkedin_url!, "_blank")}
                >
                  <Linkedin className="h-3 w-3 text-blue-600" />
                </Button>
              )}
              {speaker.watched_website && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => window.open(speaker.watched_website!, "_blank")}
                >
                  <Globe className="h-3 w-3" />
                </Button>
              )}
            </div>

            {speaker.watched_topics.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {speaker.watched_topics.slice(0, 3).map((topic, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {topic}
                  </Badge>
                ))}
                {speaker.watched_topics.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{speaker.watched_topics.length - 3}
                  </Badge>
                )}
              </div>
            )}

            <div className="mt-3 text-sm text-muted-foreground">
              {bookingsCount} booking{bookingsCount !== 1 ? "s" : ""} tracked
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onLogBooking}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Log Booking
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Track</span>
              <Switch
                checked={speaker.is_active}
                onCheckedChange={toggleActive}
                disabled={updating}
              />
            </div>
          </div>
        </div>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {speaker.watched_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this speaker from your watch list and delete all their tracked bookings.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
