import { Badge } from "@/components/ui/badge";
import { Mail, FileText, Phone, Linkedin, Globe, MapPin, Send } from "lucide-react";
import { ContactPath, OrganizerContactInfo, tierToneClass } from "@/lib/organizerContact";

const ICONS: Record<ContactPath["kind"], typeof Mail> = {
  email: Mail,
  form: FileText,
  phone: Phone,
  linkedin: Linkedin,
  social: Globe,
  address: MapPin,
  listing: Send,
};


interface Props {
  info: OrganizerContactInfo;
  compact?: boolean;
  /** Where the listing was found. Always shown when no contact path exists. */
  sourceUrl?: string | null;
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ContactPathPanel({ info, compact = false, sourceUrl }: Props) {
  const usableSource = sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : null;

  return (
    <div className={compact ? "flex flex-wrap items-center gap-x-2 gap-y-1" : "space-y-1.5"}>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={`text-[11px] font-normal ${tierToneClass(info.tier)}`}>
          {info.tier}
        </Badge>
      </div>

      {!info.hasAnyPath && (
        usableSource ? (
          <a
            href={usableSource}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
          >
            <Globe className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[240px]">
              {compact ? hostLabel(usableSource) : `Found on: ${hostLabel(usableSource)}`}
            </span>
          </a>
        ) : (
          !compact && (
            <span className="text-[11px] text-muted-foreground">
              No source link recorded for this listing.
            </span>
          )
        )
      )}



      {info.paths.length > 0 && (
        <div className={compact ? "flex flex-wrap gap-2" : "space-y-1"}>
          {info.paths.map((p, i) => {
            const Icon = ICONS[p.kind];
            const content = (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[240px]">
                  {compact ? p.label : `${p.label}: ${p.value}`}
                </span>
              </span>
            );
            return p.href ? (
              <a
                key={i}
                href={p.href}
                target={p.kind === "email" || p.kind === "phone" ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="block hover:text-primary"
              >
                {content}
              </a>
            ) : (
              <div key={i}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
