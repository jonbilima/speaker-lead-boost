import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Building2, Linkedin, DollarSign, Calendar, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Organizer {
  id: string;
  name: string;
  email: string | null;
  linkedin_url: string | null;
  organization_name: string | null;
  organization_type: string | null;
  events_organized: number;
  speakers_booked_last_year: number | null;
  typical_fee_min: number | null;
  typical_fee_max: number | null;
  topics: string[] | null;
}

export function ActiveOrganizersTab() {
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadOrganizers = async () => {
      const { data, error } = await supabase
        .from("organizers")
        .select("*")
        .order("events_organized", { ascending: false });

      if (error) {
        console.error("Error loading organizers:", error);
      } else {
        setOrganizers(data || []);
      }
      setLoading(false);
    };

    loadOrganizers();
  }, []);

  const filteredOrganizers = useMemo(() => {
    if (!searchQuery.trim()) return organizers;
    const query = searchQuery.toLowerCase();
    return organizers.filter(
      (org) =>
        org.name.toLowerCase().includes(query) ||
        org.organization_name?.toLowerCase().includes(query)
    );
  }, [organizers, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or organization..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredOrganizers.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="font-semibold text-lg mb-2">
            {organizers.length === 0 ? "Building Organizer Database" : "No Results Found"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {organizers.length === 0
              ? "We're actively building our database of event organizers. Check back soon for valuable booking insights."
              : "Try adjusting your search terms."}
          </p>
        </Card>
      ) : (
        <ScrollArea className="h-[550px]">
          <div className="space-y-3">
            {filteredOrganizers.map((organizer) => (
              <Card key={organizer.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{organizer.name}</h4>
                      {organizer.linkedin_url && (
                        <a
                          href={organizer.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Linkedin className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                    {organizer.organization_name && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {organizer.organization_name}
                        {organizer.organization_type && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {organizer.organization_type}
                          </Badge>
                        )}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {organizer.events_organized} events
                      </span>
                      {organizer.speakers_booked_last_year != null && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {organizer.speakers_booked_last_year} speakers/year
                        </span>
                      )}
                      {organizer.typical_fee_min && organizer.typical_fee_max && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${organizer.typical_fee_min.toLocaleString()} - ${organizer.typical_fee_max.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {organizer.topics && organizer.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {organizer.topics.slice(0, 5).map((topic, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                        {organizer.topics.length > 5 && (
                          <Badge variant="secondary" className="text-xs">
                            +{organizer.topics.length - 5} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
