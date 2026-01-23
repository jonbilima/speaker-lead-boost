import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Search, Plus, Users, Mail, Phone, Building, Globe, 
  Calendar, DollarSign, MessageSquare, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { AddContactDialog } from "./AddContactDialog";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  contact_type: string;
  industry: string | null;
  linkedin_url: string | null;
  website: string | null;
  notes: string | null;
  last_contact_date: string | null;
  total_revenue: number;
  created_at: string;
}

interface ContactsTabProps {
  userId: string;
}

const TYPE_COLORS: Record<string, string> = {
  prospect: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  client: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  organizer: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  lead: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

export function ContactsTab({ userId }: ContactsTabProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      // Load from contacts table
      const { data: contactsData } = await supabase
        .from("contacts")
        .select("*")
        .eq("speaker_id", userId)
        .order("name");

      // Load organizers (admin-created, accessible to users who interacted)
      const { data: organizersData } = await supabase
        .from("organizers")
        .select("*");

      // Load inbound leads
      const { data: leadsData } = await supabase
        .from("inbound_leads")
        .select("*")
        .eq("speaker_id", userId);

      // Combine all sources
      const allContacts: Contact[] = [
        ...(contactsData || []),
        // Convert organizers to contact format
        ...(organizersData || []).map((org: any) => ({
          id: `org-${org.id}`,
          name: org.name,
          email: org.email,
          phone: org.phone,
          company: org.organization_name,
          title: null,
          contact_type: "organizer",
          industry: null,
          linkedin_url: org.linkedin_url,
          website: org.organization_website,
          notes: org.notes,
          last_contact_date: org.last_booking_date,
          total_revenue: 0,
          created_at: org.created_at,
        })),
        // Convert leads to contact format
        ...(leadsData || []).map((lead: any) => ({
          id: `lead-${lead.id}`,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          title: null,
          contact_type: "lead",
          industry: null,
          linkedin_url: null,
          website: null,
          notes: lead.message,
          last_contact_date: null,
          total_revenue: 0,
          created_at: lead.created_at,
        })),
      ];

      setContacts(allContacts);
    } catch (error) {
      console.error("Error loading contacts:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const filteredContacts = contacts.filter(contact => {
    if (typeFilter !== "all" && contact.contact_type !== typeFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        contact.name.toLowerCase().includes(search) ||
        contact.email?.toLowerCase().includes(search) ||
        contact.company?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const typeCounts = {
    all: contacts.length,
    prospect: contacts.filter(c => c.contact_type === "prospect").length,
    client: contacts.filter(c => c.contact_type === "client").length,
    organizer: contacts.filter(c => c.contact_type === "organizer").length,
    lead: contacts.filter(c => c.contact_type === "lead").length,
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
      </div>

      <Tabs value={typeFilter} onValueChange={setTypeFilter}>
        <TabsList>
          <TabsTrigger value="all">All ({typeCounts.all})</TabsTrigger>
          <TabsTrigger value="prospect">Prospects ({typeCounts.prospect})</TabsTrigger>
          <TabsTrigger value="client">Clients ({typeCounts.client})</TabsTrigger>
          <TabsTrigger value="organizer">Organizers ({typeCounts.organizer})</TabsTrigger>
          <TabsTrigger value="lead">Leads ({typeCounts.lead})</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredContacts.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="font-medium mb-2">No contacts found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add your first contact to get started
          </p>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredContacts.map(contact => (
            <Card 
              key={contact.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedContact(contact)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{contact.name}</h3>
                      <Badge className={TYPE_COLORS[contact.contact_type] || ""}>
                        {contact.contact_type}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {contact.company && (
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {contact.company}
                        </span>
                      )}
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </span>
                      )}
                      {contact.industry && (
                        <span>{contact.industry}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {contact.total_revenue > 0 && (
                      <p className="font-medium text-green-600">{formatCurrency(contact.total_revenue)}</p>
                    )}
                    {contact.last_contact_date && (
                      <p className="text-xs text-muted-foreground">
                        Last: {format(new Date(contact.last_contact_date), "MMM d")}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Contact Detail Sheet */}
      <Sheet open={!!selectedContact} onOpenChange={(open) => !open && setSelectedContact(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {selectedContact && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedContact.name}</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
                <div className="space-y-6">
                  {/* Type Badge */}
                  <Badge className={TYPE_COLORS[selectedContact.contact_type] || ""}>
                    {selectedContact.contact_type}
                  </Badge>

                  {/* Details */}
                  <div className="space-y-3">
                    {selectedContact.title && selectedContact.company && (
                      <p className="text-muted-foreground">
                        {selectedContact.title} at {selectedContact.company}
                      </p>
                    )}
                    
                    {selectedContact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${selectedContact.email}`} className="text-primary hover:underline">
                          {selectedContact.email}
                        </a>
                      </div>
                    )}
                    
                    {selectedContact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${selectedContact.phone}`} className="hover:underline">
                          {selectedContact.phone}
                        </a>
                      </div>
                    )}
                    
                    {selectedContact.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a href={selectedContact.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {selectedContact.website}
                        </a>
                      </div>
                    )}
                  </div>

                  {selectedContact.notes && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-2">Notes</h4>
                        <p className="text-sm text-muted-foreground">{selectedContact.notes}</p>
                      </div>
                    </>
                  )}

                  <Separator />

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                    <Button size="sm" variant="outline">
                      <Phone className="h-4 w-4 mr-2" />
                      Log Call
                    </Button>
                    {selectedContact.email && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`mailto:${selectedContact.email}`}>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Email
                        </a>
                      </Button>
                    )}
                  </div>

                  {/* Revenue */}
                  {selectedContact.total_revenue > 0 && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total Revenue</span>
                        <span className="font-bold text-lg text-green-600">
                          {formatCurrency(selectedContact.total_revenue)}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Placeholder sections */}
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Interaction Timeline</h4>
                    <p className="text-sm text-muted-foreground italic">Coming soon...</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Related Bookings</h4>
                    <p className="text-sm text-muted-foreground italic">Coming soon...</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Related Invoices</h4>
                    <p className="text-sm text-muted-foreground italic">Coming soon...</p>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AddContactDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        userId={userId}
        onSuccess={loadContacts}
      />
    </div>
  );
}