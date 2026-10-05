import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileSignature, FileText, Upload, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ACCEPTED_DOC_TYPES,
  DOCUMENT_KIND_LABELS,
  SpeakerDocument,
  copyTemplateToEngagement,
  uploadDocument,
} from "@/lib/engagementDocs";

interface PackageDocumentsSectionProps {
  /** opportunity_scores id: the speaker's own row for this gig */
  matchId: string;
  eventName: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** reports loaded docs so the preview can list them */
  onDocumentsLoaded?: (docs: SpeakerDocument[]) => void;
}

/* The "Contract and documents" block inside the package builder.
 *
 * The contract belongs to this one engagement: upload it here, or copy a
 * saved template onto it. Tech riders and other documents come from the
 * speaker's library and are attached with a checkbox. Contracts for other
 * engagements never show up here. */
export function PackageDocumentsSection({
  matchId,
  eventName,
  selectedIds,
  onChange,
  onDocumentsLoaded,
}: PackageDocumentsSectionProps) {
  const [docs, setDocs] = useState<SpeakerDocument[]>([]);
  const [topicNames, setTopicNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data, error } = await supabase
      .from("speaker_documents")
      .select("*")
      .eq("speaker_id", session.user.id)
      .order("created_at", { ascending: false });
    if (error) console.error("Error loading documents:", error);
    const list = ((data ?? []) as SpeakerDocument[]).filter(
      (d) => d.kind !== "contract" || d.match_id === matchId,
    );
    setDocs(list);
    onDocumentsLoaded?.(list);

    const topicIds = Array.from(new Set(list.map((d) => d.topic_id).filter(Boolean))) as string[];
    if (topicIds.length) {
      const { data: topics } = await supabase.from("topics").select("id, name").in("id", topicIds);
      setTopicNames(Object.fromEntries((topics ?? []).map((t) => [t.id, t.name])));
    }
    setLoading(false);
    return list;
  }, [matchId, onDocumentsLoaded]);

  useEffect(() => {
    setLoading(true);
    load().then((list) => {
      // Contracts already on this engagement go in by default.
      const existing = (list ?? []).filter((d) => d.kind === "contract").map((d) => d.id);
      if (existing.length) onChange(Array.from(new Set([...selectedIds, ...existing])));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const contracts = docs.filter((d) => d.kind === "contract");
  const templates = docs.filter((d) => d.kind === "contract_template");
  const supporting = docs.filter((d) => d.kind === "av_requirements" || d.kind === "other");

  const toggle = (id: string, on: boolean) =>
    onChange(on ? Array.from(new Set([...selectedIds, id])) : selectedIds.filter((x) => x !== id));

  const addAndSelect = async (doc: SpeakerDocument) => {
    await load();
    onChange(Array.from(new Set([...selectedIds, doc.id])));
  };

  const handleUploadContract = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const doc = await uploadDocument({ file, kind: "contract", title: `Contract: ${eventName}`, matchId });
      await addAndSelect(doc);
      toast.success("Contract attached to this package");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleUseTemplate = async (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setBusy(true);
    try {
      const doc = await copyTemplateToEngagement(template, matchId, eventName);
      await addAndSelect(doc);
      toast.success("Template copied onto this engagement", {
        description: "Download it, fill in the event details, then upload the finished version.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't copy the template");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your documents...
      </div>
    );
  }

  const row = (doc: SpeakerDocument, sub: string) => (
    <Card key={doc.id} className="p-3">
      <div className="flex items-center gap-3">
        <Checkbox
          id={`doc-${doc.id}`}
          checked={selectedIds.includes(doc.id)}
          onCheckedChange={(checked) => toggle(doc.id, checked as boolean)}
        />
        <Label htmlFor={`doc-${doc.id}`} className="flex-1 min-w-0 cursor-pointer">
          <span className="block truncate">{doc.title}</span>
          <span className="block text-xs font-normal text-muted-foreground truncate">{sub}</span>
        </Label>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-muted-foreground" />
          Contract for this engagement
        </Label>
        {contracts.map((d) => row(d, d.file_name))}
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_DOC_TYPES}
            className="hidden"
            onChange={(e) => handleUploadContract(e.target.files?.[0])}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Upload contract
          </Button>
          {templates.length > 0 && (
            <Select onValueChange={handleUseTemplate} disabled={busy}>
              <SelectTrigger className="h-9 w-auto min-w-[200px]">
                <SelectValue placeholder="Start from a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {templates.length === 0 && contracts.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Tip: save your standard agreement as a template on Speaker Assets, then copy it onto
            each new engagement here.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Supporting documents
        </Label>
        {supporting.length === 0 ? (
          <p className="text-xs text-muted-foreground">No AV requirements or other documents saved yet.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {supporting.map((d) =>
              row(
                d,
                [DOCUMENT_KIND_LABELS[d.kind], d.topic_id ? topicNames[d.topic_id] : null]
                  .filter(Boolean)
                  .join(" · "),
              ),
            )}
          </div>
        )}
        <a
          href="/assets?tab=documents"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Manage templates, tech riders and other documents
        </a>
      </div>
    </div>
  );
}
