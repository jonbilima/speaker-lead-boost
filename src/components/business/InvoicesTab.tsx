import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Eye, Edit, Send, Bell, CheckCircle, Trash2, FileText, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreateInvoiceDialog, InvoiceKind } from "./CreateInvoiceDialog";

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
  invoice_kind: string;
  deposit_percent: number | null;
  parent_invoice_id: string | null;
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
  // Remount the dialog per open so a cancelled balance invoice doesn't linger.
  const [dialogKey, setDialogKey] = useState(0);
  const [dialogPreset, setDialogPreset] = useState<{ bookingId: string; kind: InvoiceKind } | null>(null);
  const [bookingNames, setBookingNames] = useState<Record<string, string>>({});
  const [contactNames, setContactNames] = useState<Record<string, string>>({});

  const openCreate = (preset: { bookingId: string; kind: InvoiceKind } | null = null) => {
    setDialogPreset(preset);
    setDialogKey((k) => k + 1);
    setCreateDialogOpen(true);
  };

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
      const list = (data || []) as Invoice[];
      setInvoices(list);

      const bookingIds = Array.from(new Set(list.map((i) => i.booking_id).filter(Boolean))) as string[];
      const contactIds = Array.from(new Set(list.map((i) => i.contact_id).filter(Boolean))) as string[];
      const [bookingsRes, contactsRes] = await Promise.all([
        bookingIds.length
          ? supabase.from("confirmed_bookings").select("id, event_name").in("id", bookingIds)
          : Promise.resolve({ data: [] as { id: string; event_name: string }[] }),
        contactIds.length
          ? supabase.from("contacts").select("id, name").in("id", contactIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);
      setBookingNames(Object.fromEntries((bookingsRes.data || []).map((b) => [b.id, b.event_name])));
      setContactNames(Object.fromEntries((contactsRes.data || []).map((c) => [c.id, c.name])));
    } catch (error) {
      console.error("Error loading invoices:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, statusFilter]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Keep the booking's "amount paid" in step with paid invoices. Speakers also
  // type amount_paid by hand on the booking, so this only ever raises it.
  const syncBookingPayment = async (bookingId: string) => {
    const [{ data: booking }, { data: paid }] = await Promise.all([
      supabase
        .from("confirmed_bookings")
        .select("confirmed_fee, amount_paid, payment_status, payment_date")
        .eq("id", bookingId)
        .maybeSingle(),
      supabase.from("invoices").select("subtotal").eq("booking_id", bookingId).eq("status", "paid"),
    ]);
    if (!booking || booking.payment_status === "cancelled") return;

    const invoicedPaid = (paid || []).reduce((sum, i) => sum + Number(i.subtotal || 0), 0);
    const amountPaid = Math.max(Number(booking.amount_paid || 0), invoicedPaid);
    const fee = Number(booking.confirmed_fee || 0);
    const status = fee > 0 && amountPaid >= fee ? "paid" : amountPaid > 0 ? "partial" : "pending";

    const { error } = await supabase
      .from("confirmed_bookings")
      .update({
        amount_paid: amountPaid,
        payment_status: status,
        payment_date:
          status === "paid" && !booking.payment_date
            ? new Date().toISOString().split("T")[0]
            : booking.payment_date,
      })
      .eq("id", bookingId);
    if (error) console.error("Couldn't update booking payment:", error);
  };

  const updateInvoiceStatus = async (invoice: Invoice, newStatus: string) => {
    try {
      const updates: { status: string; sent_at?: string; paid_at?: string } = { status: newStatus };
      if (newStatus === "sent") updates.sent_at = new Date().toISOString();
      if (newStatus === "paid") updates.paid_at = new Date().toISOString();

      const { error } = await supabase
        .from("invoices")
        .update(updates)
        .eq("id", invoice.id);
      if (error) throw error;

      if (newStatus === "paid" && invoice.booking_id) {
        await syncBookingPayment(invoice.booking_id);
      }

      toast.success(
        newStatus === "paid" && invoice.invoice_kind === "deposit"
          ? "Deposit marked paid. You're clear to book travel."
          : `Invoice marked as ${newStatus}`,
      );
      loadInvoices();
    } catch (error) {
      toast.error("Failed to update invoice");
    }
  };

  const hasBalanceInvoice = (depositId: string) =>
    invoices.some((i) => i.invoice_kind === "balance" && i.parent_invoice_id === depositId);

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
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openCreate({ bookingId: "", kind: "deposit" })}>
            <Receipt className="h-4 w-4 mr-2" />
            Bill a Deposit
          </Button>
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
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
              <Button onClick={() => openCreate()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>For</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(invoice => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {invoice.invoice_number}
                        {invoice.invoice_kind === "deposit" && (
                          <Badge variant="outline">
                            Deposit{invoice.deposit_percent ? ` ${Number(invoice.deposit_percent)}%` : ""}
                          </Badge>
                        )}
                        {invoice.invoice_kind === "balance" && <Badge variant="outline">Balance</Badge>}
                      </div>
                      {invoice.invoice_kind === "deposit" && invoice.status !== "paid" && invoice.status !== "draft" && (
                        <p className="text-xs font-normal text-amber-600 dark:text-amber-400 mt-1">
                          Hold travel until paid
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {(invoice.booking_id && bookingNames[invoice.booking_id]) ||
                        (invoice.contact_id && contactNames[invoice.contact_id]) ||
                        "Not linked"}
                    </TableCell>
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
                            <DropdownMenuItem onClick={() => updateInvoiceStatus(invoice, "sent")}>
                              <Send className="h-4 w-4 mr-2" />
                              Send
                            </DropdownMenuItem>
                          )}
                          {(invoice.status === "sent" || invoice.status === "overdue") && (
                            <>
                              <DropdownMenuItem onClick={() => updateInvoiceStatus(invoice, "sent")}>
                                <Bell className="h-4 w-4 mr-2" />
                                Send Reminder
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateInvoiceStatus(invoice, "paid")}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark Paid
                              </DropdownMenuItem>
                            </>
                          )}
                          {invoice.invoice_kind === "deposit" && invoice.booking_id && !hasBalanceInvoice(invoice.id) && (
                            <DropdownMenuItem
                              onClick={() => openCreate({ bookingId: invoice.booking_id!, kind: "balance" })}
                            >
                              <Receipt className="h-4 w-4 mr-2" />
                              Create Balance Invoice
                            </DropdownMenuItem>
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
        key={dialogKey}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        userId={userId}
        onSuccess={loadInvoices}
        initialBookingId={dialogPreset?.bookingId || null}
        initialKind={dialogPreset?.kind}
      />
    </div>
  );
}