import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Upload, Download, Trash2, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ACCEPTED_DOC_TYPES,
  DOCUMENT_KIND_LABELS,
  DocumentKind,
  SpeakerDocument,
  deleteDocument,
  formatFileSize,
  openDocument,
  uploadDocument,
} from "@/lib/engagementDocs";

const LIBRARY_KINDS: { id: DocumentKind; hint: string }[] = [
  {
    id: "contract_template",
    hint: "Your standard speaking agreement. Copy it onto any engagement as a starting contract.",
  },
  {
    id: "av_requirements",
    hint: "Mics, screens, staging, internet. Tie it to a topic if a talk needs special setup.",
  },
  { id: "other", hint: "W-9, insurance certificate, travel rider, anything an organizer asks for." },
];

interface Topic {
  id: string;
  name: string;
}

interface EventLabel {
  id: string;
  event_name: string;
}

export function DocumentsLibrary() {
  const [docs, setDocs] = useState<SpeakerDocument[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [events, setEvents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<DocumentKind>("contract_template");
  const [title, setTitle] = useState("");
  const [topicId, setTopicId] = useState<string>("none");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setLoading(true);

    const [docsRes, topicsRes] = await Promise.all([
      supabase
        .from("speaker_documents")
        .select("*")
        .eq("speaker_id", session.user.id)
        .order("created_at", { ascending: false }),
      supabase.from("user_topics").select("topic_id, topics(id, name)").eq("user_id", session.user.id),
    ]);

    if (docsRes.error) {
      console.error("Error loading documents:", docsRes.error);
      toast.error("Couldn't load your documents");
    }
    const list = (docsRes.data ?? []) as SpeakerDocument[];
    setDocs(list);
    setTopics(
      ((topicsRes.data ?? []) as { topics: Topic | null }[])
        .map((r) => r.topics)
        .filter((t): t is Topic => !!t),
    );

    // Name the engagement each contract belongs to.
    const matchIds = Array.from(new Set(list.map((d) => d.match_id).filter(Boolean))) as string[];
    if (matchIds.length) {
      const { data: scores } = await supabase
        .from("opportunity_scores")
        .select("id, opportunities(event_name)")
        .in("id", matchIds);
      const map: Record<string, string> = {};
      ((scores ?? []) as { id: string; opportunities: { event_name: string } | null }[]).forEach((s) => {
        if (s.opportunities) map[s.id] = s.opportunities.event_name;
      });
      setEvents(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocument({
        file,
        kind,
        title: title || file.name.replace(/\.[^.]+$/, ""),
        topicId: kind === "av_requirements" && topicId !== "none" ? topicId : null,
      });
      toast.success("Document saved");
      setFile(null);
      setTitle("");
      setTopicId("none");
      if (fileInput.current) fileInput.current.value = "";
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: SpeakerDocument) => {
    if (!window.confirm(`Delete "${doc.title}"? Packages you already sent will stop showing it.`)) return;
    try {
      await deleteDocument(doc);
      toast.success("Document deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete it");
    }
  };

  const handleOpen = async (doc: SpeakerDocument) => {
    try {
      await openDocument(doc);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open it");
    }
  };

  const topicName = (id: string | null) => topics.find((t) => t.id === id)?.name;
  const sections: { id: DocumentKind; label: string; items: SpeakerDocument[] }[] = [
    { id: "contract_template", label: "Contract templates", items: docs.filter((d) => d.kind === "contract_template") },
    { id: "contract", label: "Engagement contracts", items: docs.filter((d) => d.kind === "contract") },
    { id: "av_requirements", label: "AV and tech requirements", items: docs.filter((d) => d.kind === "av_requirements") },
    { id: "other", label: "Other documents", items: docs.filter((d) => d.kind === "other") },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-muted/40 text-sm text-muted-foreground flex gap-3">
        <Lock className="h-4 w-4 mt-0.5 shrink-0 text-violet-600" />
        <p>
          These files are private. Nobody sees them unless you attach one to a speaker package.
          The organizer you send that package to gets a download link for just the documents you
          attached. Contracts for a specific engagement are added from that gig's speaker package
          in your pipeline.
        </p>
      </Card>

      <Card className="p-4 space-y-4">
        <h3 className="font-semibold">Add a document</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as DocumentKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIBRARY_KINDS.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {DOCUMENT_KIND_LABELS[k.id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {LIBRARY_KINDS.find((k) => k.id === kind)?.hint}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === "contract_template" ? "Standard speaking agreement" : "Keynote tech rider"}
            />
          </div>
          {kind === "av_requirements" && (
            <div className="space-y-2">
              <Label>Topic (optional)</Label>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Applies to every talk</SelectItem>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>File (PDF, Word or image, up to 25 MB)</Label>
            <Input
              ref={fileInput}
              type="file"
              accept={ACCEPTED_DOC_TYPES}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <Button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="bg-violet-600 hover:bg-violet-700"
        >
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          {uploading ? "Uploading..." : "Save document"}
        </Button>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      ) : docs.length === 0 ? (
        <Card className="p-10 text-center">
          <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">
            No documents yet. Start with your standard contract and your AV requirements.
          </p>
        </Card>
      ) : (
        sections
          .filter((s) => s.items.length > 0)
          .map((s) => (
            <div key={s.id} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{s.label}</h3>
              {s.items.map((doc) => (
                <Card key={doc.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-3">
                    <FileText className="h-5 w-5 shrink-0 text-violet-600" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {doc.file_name}
                        {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ""}
                      </p>
                    </div>
                    {doc.match_id && events[doc.match_id] && (
                      <Badge variant="secondary" className="hidden md:inline-flex">
                        {events[doc.match_id]}
                      </Badge>
                    )}
                    {topicName(doc.topic_id) && (
                      <Badge variant="outline" className="hidden md:inline-flex">
                        {topicName(doc.topic_id)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => handleOpen(doc)} aria-label="Download">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(doc)} aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ))
      )}
    </div>
  );
}
