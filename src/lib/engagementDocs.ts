import { supabase } from "@/integrations/supabase/client";

/* Contracts, tech riders and other engagement documents.
 *
 * Files live in the PRIVATE engagement-docs bucket under {speaker_id}/...,
 * never in the public speaker-assets bucket: a contract carries fees, deposit
 * terms and client names. Speakers open their own through short-lived signed
 * links; organizers get them through the package-view function, and only for
 * documents attached to the package they were sent. */

export type DocumentKind = "contract" | "contract_template" | "av_requirements" | "other";

export interface SpeakerDocument {
  id: string;
  speaker_id: string;
  kind: DocumentKind;
  title: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  topic_id: string | null;
  match_id: string | null;
  created_at: string;
}

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  contract: "Contract",
  contract_template: "Contract template",
  av_requirements: "AV and tech requirements",
  other: "Other document",
};

export const ACCEPTED_DOC_TYPES = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt";
const MAX_BYTES = 25 * 1024 * 1024;
const BUCKET = "engagement-docs";

const safeName = (name: string) => name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-120) || "document";

async function currentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in again to manage your documents.");
  return user.id;
}

export async function uploadDocument(opts: {
  file: File;
  kind: DocumentKind;
  title: string;
  topicId?: string | null;
  matchId?: string | null;
}): Promise<SpeakerDocument> {
  const { file, kind } = opts;
  if (file.size > MAX_BYTES) throw new Error("That file is over 25 MB. Try a smaller PDF.");
  const uid = await currentUserId();
  const path = `${uid}/${crypto.randomUUID()}-${safeName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (uploadError) throw new Error(uploadError.message || "Upload failed.");

  const { data, error } = await supabase
    .from("speaker_documents")
    .insert({
      speaker_id: uid,
      kind,
      title: opts.title.trim() || file.name,
      file_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
      topic_id: opts.topicId ?? null,
      match_id: opts.matchId ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    // Don't leave an orphaned file behind if the record couldn't be saved.
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(error?.message || "Couldn't save the document.");
  }
  return data as SpeakerDocument;
}

/** Copy a saved contract template onto one engagement as its starting contract. */
export async function copyTemplateToEngagement(
  template: SpeakerDocument,
  matchId: string,
  eventName: string,
): Promise<SpeakerDocument> {
  const uid = await currentUserId();
  const dest = `${uid}/${crypto.randomUUID()}-${safeName(template.file_name)}`;
  const { error: copyError } = await supabase.storage.from(BUCKET).copy(template.file_path, dest);
  if (copyError) throw new Error(copyError.message || "Couldn't copy the template.");

  const { data, error } = await supabase
    .from("speaker_documents")
    .insert({
      speaker_id: uid,
      kind: "contract",
      title: `Contract: ${eventName}`.slice(0, 200),
      file_path: dest,
      file_name: template.file_name,
      mime_type: template.mime_type,
      file_size: template.file_size,
      match_id: matchId,
    })
    .select("*")
    .single();

  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([dest]);
    throw new Error(error?.message || "Couldn't save the contract.");
  }
  return data as SpeakerDocument;
}

/** Open one of the speaker's own documents in a new tab. */
export async function openDocument(doc: Pick<SpeakerDocument, "file_path" | "file_name">) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.file_path, 300, { download: doc.file_name });
  if (error || !data) throw new Error("Couldn't open that document.");
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export async function deleteDocument(doc: Pick<SpeakerDocument, "id" | "file_path">) {
  const { error } = await supabase.from("speaker_documents").delete().eq("id", doc.id);
  if (error) throw new Error(error.message || "Couldn't delete the document.");
  await supabase.storage.from(BUCKET).remove([doc.file_path]);
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
