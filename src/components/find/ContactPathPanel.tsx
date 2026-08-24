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
}

export function ContactPathPanel({ info, compact = false }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={`text-[11px] font-normal ${tierToneClass(info.tier)}`}>
          {info.tier}
        </Badge>
        {!info.hasAnyPath && !compact && (
          <span className="text-[11px] text-muted-foreground">
            Try the event website directly.
          </span>
        )}
      </div>

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
