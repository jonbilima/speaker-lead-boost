import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Eye, Edit, Send, Bell, CheckCircle, Trash2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreateInvoiceDialog } from "./CreateInvoiceDialog";

interface Invoice {
  id: string;
  invoice_number: string;
  contact_id: string | null;
  booking_id: string | null;
  status: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  created_at: string;
}

interface InvoicesTabProps {
  userId: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function InvoicesTab({ userId }: InvoicesTabProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("invoices")
        .select("*")
        .eq("speaker_id", userId)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error("Error loading invoices:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, statusFilter]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const updateInvoiceStatus = async (invoiceId: string, newStatus: string) => {
    try {
      const updates: any = { status: newStatus };
      if (newStatus === "sent") updates.sent_at = new Date().toISOString();
      if (newStatus === "paid") updates.paid_at = new Date().toISOString();

      await supabase
        .from("invoices")
        .update(updates)
        .eq("id", invoiceId);

      toast.success(`Invoice marked as ${newStatus}`);
      loadInvoices();
    } catch (error) {
      toast.error("Failed to update invoice");
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    try {
      await supabase
        .from("invoices")
        .delete()
        .eq("id", invoiceId);

      toast.success("Invoice deleted");
      loadInvoices();
    } catch (error) {
      toast.error("Failed to delete invoice");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

  const statusCounts = {
    all: invoices.length,
    draft: invoices.filter(i => i.status === "draft").length,
    sent: invoices.filter(i => i.status === "sent").length,
    paid: invoices.filter(i => i.status === "paid").length,
    overdue: invoices.filter(i => i.status === "overdue").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
            <TabsTrigger value="draft">Draft ({statusCounts.draft})</TabsTrigger>
            <TabsTrigger value="sent">Sent ({statusCounts.sent})</TabsTrigger>
            <TabsTrigger value="paid">Paid ({statusCounts.paid})</TabsTrigger>
            <TabsTrigger value="overdue">Overdue ({statusCounts.overdue})</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
              <h3 className="font-medium mb-2">No invoices yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first invoice to get started
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(invoice => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>{formatCurrency(invoice.total)}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[invoice.status] || ""}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(invoice.due_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {invoice.status === "draft" && (
                            <DropdownMenuItem onClick={() => updateInvoiceStatus(invoice.id, "sent")}>
                              <Send className="h-4 w-4 mr-2" />
                              Send
                            </DropdownMenuItem>
                          )}
                          {(invoice.status === "sent" || invoice.status === "overdue") && (
                            <>
                              <DropdownMenuItem onClick={() => updateInvoiceStatus(invoice.id, "sent")}>
                                <Bell className="h-4 w-4 mr-2" />
                                Send Reminder
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateInvoiceStatus(invoice.id, "paid")}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark Paid
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem 
                            className="text-destructive" 
                            onClick={() => deleteInvoice(invoice.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateInvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        userId={userId}
        onSuccess={loadInvoices}
      />
    </div>
  );
}