import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  MoveRight,
  Tag,
  Download,
  Trash2,
  Sparkles,
  X,
  Loader2,
  Plus,
  Check,
} from "lucide-react";
import { PipelineTag } from "@/hooks/usePipelineBulkActions";

const PIPELINE_STAGES = [
  { id: "new", label: "New" },
  { id: "interested", label: "Interested" },
  { id: "pitched", label: "Applied" },
  { id: "negotiating", label: "In Conversation" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
];

const TAG_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#64748b",
];

interface BulkActionToolbarProps {
  selectedCount: number;
  isProcessing: boolean;
  processingProgress: { current: number; total: number; message: string };
  tags: PipelineTag[];
  onCancel: () => void;
  onMoveToStage: (stage: string) => void;
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onCreateTag: (name: string, color: string) => Promise<PipelineTag | null>;
  onExport: () => void;
  onDelete: () => void;
  onGeneratePitches: () => void;
}

export function BulkActionToolbar({
  selectedCount,
  isProcessing,
  processingProgress,
  tags,
  onCancel,
  onMoveToStage,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  onExport,
  onDelete,
  onGeneratePitches,
}: BulkActionToolbarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showMoveConfirm, setShowMoveConfirm] = useState(false);
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const handleMoveClick = (stageId: string) => {
    setPendingStage(stageId);
    setShowMoveConfirm(true);
  };

  const confirmMove = () => {
    if (pendingStage) {
      onMoveToStage(pendingStage);
    }
    setShowMoveConfirm(false);
    setPendingStage(null);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    const tag = await onCreateTag(newTagName.trim(), newTagColor);
    if (tag) {
      setNewTagName("");
      setShowNewTagInput(false);
    }
  };

  const confirmDelete = () => {
    if (deleteConfirmText === "DELETE") {
      onDelete();
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      {/* Sticky Toolbar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg p-4 md:left-[var(--sidebar-width,0px)]">
        {isProcessing ? (
          <div className="flex items-center gap-4 max-w-4xl mx-auto">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{processingProgress.message}</p>
              <Progress 
                value={(processingProgress.current / processingProgress.total) * 100} 
                className="h-2 mt-1"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {processingProgress.current} / {processingProgress.total}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 md:gap-4 max-w-4xl mx-auto overflow-x-auto pb-2 md:pb-0">
            <Badge variant="secondary" className="shrink-0 text-sm py-1 px-3">
              {selectedCount} selected
            </Badge>

            {/* Move to Stage */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                  <MoveRight className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Move to</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {PIPELINE_STAGES.map((stage) => (
                  <DropdownMenuItem
                    key={stage.id}
                    onClick={() => handleMoveClick(stage.id)}
                  >
                    {stage.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Add Tag */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                  <Tag className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Tag</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                {tags.length > 0 && (
                  <>
                    {tags.map((tag) => (
                      <DropdownMenuItem
                        key={tag.id}
                        onClick={() => onAddTag(tag.id)}
                      >
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}
                {showNewTagInput ? (
                  <div className="p-2">
                    <Input
                      placeholder="Tag name"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className="h-8 mb-2"
                      autoFocus
                    />
                    <div className="flex flex-wrap gap-1 mb-2">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewTagColor(color)}
                          className={`w-6 h-6 rounded-full transition-transform ${
                            newTagColor === color ? "ring-2 ring-offset-2 ring-primary scale-110" : ""
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowNewTagInput(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCreateTag}
                        disabled={!newTagName.trim()}
                        className="flex-1"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Create
                      </Button>
                    </div>
                  </div>
                ) : (
                  <DropdownMenuItem onClick={() => setShowNewTagInput(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create new tag
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Remove Tag */}
            {tags.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="shrink-0">
                    <Tag className="h-4 w-4 mr-1 opacity-50" />
                    <span className="hidden sm:inline">Remove Tag</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {tags.map((tag) => (
                    <DropdownMenuItem
                      key={tag.id}
                      onClick={() => onRemoveTag(tag.id)}
                    >
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Export */}
            <Button variant="outline" size="sm" onClick={onExport} className="shrink-0">
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Export</span>
            </Button>

            {/* Generate Pitches */}
            <Button variant="outline" size="sm" onClick={onGeneratePitches} className="shrink-0">
              <Sparkles className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Generate Pitches</span>
            </Button>

            {/* Delete */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="shrink-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Delete</span>
            </Button>

            {/* Cancel */}
            <Button variant="ghost" size="sm" onClick={onCancel} className="shrink-0 ml-auto">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Move Confirmation Dialog */}
      <AlertDialog open={showMoveConfirm} onOpenChange={setShowMoveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {selectedCount} opportunities?</AlertDialogTitle>
            <AlertDialogDescription>
              Move {selectedCount} opportunities to "{PIPELINE_STAGES.find((s) => s.id === pendingStage)?.label}"?
              {pendingStage === "pitched" && (
                <span className="block mt-2 text-primary">
                  Follow-up reminders will be created for each opportunity.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowMoveConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={confirmMove}>Move</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} opportunities?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive {selectedCount} opportunities from your pipeline. This action cannot be easily undone.
              <p className="mt-4 font-medium">Type DELETE to confirm:</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="DELETE"
            className="mt-2"
          />
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDeleteConfirm(false);
              setDeleteConfirmText("");
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteConfirmText !== "DELETE"}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
