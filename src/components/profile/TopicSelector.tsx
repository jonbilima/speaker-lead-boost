import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Search, X, Plus, Check } from "lucide-react";

interface Topic {
  id: string;
  name: string;
  category?: string;
}

interface TopicSelectorProps {
  allTopics: Topic[];
  selectedTopicIds: string[];
  customTopics: string[];
  onToggleTopic: (topicId: string) => void;
  onAddCustomTopic: (topic: string) => void;
  onRemoveCustomTopic: (topic: string) => void;
}

const CATEGORY_ORDER = [
  "Technology & Business",
  "Wellness & Personal Development",
  "Industry Verticals",
  "Audience-Specific",
  "Professional Skills",
  "Social & Cultural",
];

export function TopicSelector({
  allTopics,
  selectedTopicIds,
  customTopics,
  onToggleTopic,
  onAddCustomTopic,
  onRemoveCustomTopic,
}: TopicSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER));
  const [customTopicInput, setCustomTopicInput] = useState("");

  // Group topics by category
  const topicsByCategory = useMemo(() => {
    const grouped: Record<string, Topic[]> = {};
    allTopics.forEach((topic) => {
      const category = topic.category || "Other";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(topic);
    });
    // Sort topics within each category
    Object.keys(grouped).forEach((cat) => {
      grouped[cat].sort((a, b) => a.name.localeCompare(b.name));
    });
    return grouped;
  }, [allTopics]);

  // Filter topics based on search
  const filteredTopicsByCategory = useMemo(() => {
    if (!searchQuery.trim()) return topicsByCategory;
    
    const query = searchQuery.toLowerCase();
    const filtered: Record<string, Topic[]> = {};
    
    Object.entries(topicsByCategory).forEach(([category, topics]) => {
      const matchingTopics = topics.filter((t) =>
        t.name.toLowerCase().includes(query)
      );
      if (matchingTopics.length > 0) {
        filtered[category] = matchingTopics;
      }
    });
    
    return filtered;
  }, [topicsByCategory, searchQuery]);

  // Get selected topics for display at top
  const selectedTopics = useMemo(() => {
    return allTopics.filter((t) => selectedTopicIds.includes(t.id));
  }, [allTopics, selectedTopicIds]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const selectAllInCategory = (category: string) => {
    const categoryTopics = topicsByCategory[category] || [];
    categoryTopics.forEach((topic) => {
      if (!selectedTopicIds.includes(topic.id)) {
        onToggleTopic(topic.id);
      }
    });
  };

  const deselectAllInCategory = (category: string) => {
    const categoryTopics = topicsByCategory[category] || [];
    categoryTopics.forEach((topic) => {
      if (selectedTopicIds.includes(topic.id)) {
        onToggleTopic(topic.id);
      }
    });
  };

  const handleAddCustomTopic = () => {
    const trimmed = customTopicInput.trim();
    if (trimmed && !customTopics.includes(trimmed)) {
      onAddCustomTopic(trimmed);
      setCustomTopicInput("");
    }
  };

  const getCategorySelectedCount = (category: string) => {
    const categoryTopics = topicsByCategory[category] || [];
    return categoryTopics.filter((t) => selectedTopicIds.includes(t.id)).length;
  };

  // Sort categories in the defined order
  const sortedCategories = useMemo(() => {
    const categories = Object.keys(filteredTopicsByCategory);
    return categories.sort((a, b) => {
      const aIndex = CATEGORY_ORDER.indexOf(a);
      const bIndex = CATEGORY_ORDER.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [filteredTopicsByCategory]);

  return (
    <div className="space-y-4">
      {/* Selected Topics Display */}
      {(selectedTopics.length > 0 || customTopics.length > 0) && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Selected Topics ({selectedTopics.length + customTopics.length})
          </label>
          <div className="flex flex-wrap gap-2 p-3 bg-primary/5 rounded-md border border-primary/20">
            {selectedTopics.map((topic) => (
              <Badge
                key={topic.id}
                variant="default"
                className="cursor-pointer gap-1"
                onClick={() => onToggleTopic(topic.id)}
              >
                {topic.name}
                <X className="h-3 w-3" />
              </Badge>
            ))}
            {customTopics.map((topic) => (
              <Badge
                key={`custom-${topic}`}
                variant="secondary"
                className="cursor-pointer gap-1 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                onClick={() => onRemoveCustomTopic(topic)}
              >
                {topic}
                <X className="h-3 w-3" />
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search topics..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Categories */}
      <ScrollArea className="h-[350px] border rounded-md">
        <div className="p-2 space-y-1">
          {sortedCategories.map((category) => {
            const topics = filteredTopicsByCategory[category];
            const selectedCount = getCategorySelectedCount(category);
            const totalCount = topicsByCategory[category]?.length || 0;
            const isExpanded = expandedCategories.has(category);
            const allSelected = selectedCount === totalCount && totalCount > 0;

            return (
              <Collapsible
                key={category}
                open={isExpanded}
                onOpenChange={() => toggleCategory(category)}
              >
                <div className="flex items-center gap-2 py-1">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex-1 justify-start gap-2 h-8">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{category}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {selectedCount}/{totalCount}
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (allSelected) {
                        deselectAllInCategory(category);
                      } else {
                        selectAllInCategory(category);
                      }
                    }}
                  >
                    {allSelected ? "Clear" : "Select All"}
                  </Button>
                </div>
                <CollapsibleContent>
                  <div className="flex flex-wrap gap-1.5 pl-6 pr-2 pb-2">
                    {topics.map((topic) => {
                      const isSelected = selectedTopicIds.includes(topic.id);
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => onToggleTopic(topic.id)}
                          className={`px-2.5 py-1 rounded-full text-xs transition-colors flex items-center gap-1 ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted/80 text-foreground"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          {topic.name}
                        </button>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {sortedCategories.length === 0 && searchQuery && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No topics found matching "{searchQuery}"
            </p>
          )}
        </div>
      </ScrollArea>

      {/* Custom Topic Entry */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          Can't find your topic? Add a custom one:
        </label>
        <div className="flex gap-2">
          <Input
            placeholder="Enter custom topic..."
            value={customTopicInput}
            onChange={(e) => setCustomTopicInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustomTopic();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAddCustomTopic}
            disabled={!customTopicInput.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
