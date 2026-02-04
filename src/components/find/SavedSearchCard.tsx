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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SavedSearch } from "@/hooks/useSavedSearches";
import { MoreHorizontal, Pencil, Copy, Trash2, Bell, BellOff, GripVertical } from "lucide-react";

interface SavedSearchCardProps {
  search: SavedSearch;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleNotify: () => void;
  isDragging?: boolean;
  dragHandleProps?: any;
}

export function SavedSearchCard({
  search,
  isActive,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleNotify,
  isDragging,
  dragHandleProps,
}: SavedSearchCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDelete = () => {
    setMenuOpen(false);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div
        className={`group flex items-center gap-2 rounded-md transition-all ${
          isDragging ? "opacity-50" : ""
        }`}
      >
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        <Button
          variant={isActive ? "secondary" : "ghost"}
          className="flex-1 justify-start h-auto py-2 px-2"
          onClick={onSelect}
        >
          <span className="text-lg mr-2">{search.icon}</span>
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{search.name}</span>
              {search.notify_new_matches && (
                <Bell className="h-3 w-3 text-primary shrink-0" />
              )}
            </div>
          </div>
          <Badge variant="secondary" className="ml-2 shrink-0">
            {search.results_count}
          </Badge>
        </Button>

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleNotify}>
              {search.notify_new_matches ? (
                <>
                  <BellOff className="h-4 w-4 mr-2" />
                  Disable notifications
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-2" />
                  Enable notifications
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete saved search?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{search.name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
