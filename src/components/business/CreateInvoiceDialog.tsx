import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Plus, Trash2, FileText, Send, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { useEmailSender } from "@/hooks/useEmailSender";

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess: () => void;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

const PRESET_ITEMS = [
  { description: "Speaking Fee", rate: 5000 },
  { description: "Travel Expenses", rate: 500 },
  { description: "Materials/Handouts", rate: 250 },
  { description: "Virtual Session Add-on", rate: 500 },
];

export function CreateInvoiceDialog({ open, onOpenChange, userId, onSuccess }: CreateInvoiceDialogProps) {
  const { sendEmail, isSending: emailSending } = useEmailSender();
  const [saving, setSaving] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "Speaking Fee", quantity: 1, rate: 0, amount: 0 }
  ]);
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");

  useEffect(() => {
    if (open) {
      loadContacts();
    }
  }, [open]);

  const loadContacts = async () => {
    try {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, company")
        .eq("speaker_id", userId)
        .order("name");
      setContacts(data || []);
    } catch (error) {
      // Contacts table might not have data yet
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), description: "", quantity: 1, rate: 0, amount: 0 }
    ]);
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(items => items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      updated.amount = updated.quantity * updated.rate;
      return updated;
    }));
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(items => items.filter(item => item.id !== id));
    }
  };

  const addPresetItem = (preset: typeof PRESET_ITEMS[0]) => {
    setLineItems([
      ...lineItems,
      { 
        id: crypto.randomUUID(), 
        description: preset.description, 
        quantity: 1, 
        rate: preset.rate, 
        amount: preset.rate 
      }
    ]);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `INV-${year}${month}-${random}`;
  };

  const handleSave = async (send: boolean = false) => {
    if (lineItems.every(item => !item.description || item.amount === 0)) {
      toast.error("Please add at least one line item");
      return;
    }

    setSaving(true);
    try {
      // Get contact email if sending
      let contactEmail = null;
      if (send && selectedContactId) {
        const selectedContact = contacts.find(c => c.id === selectedContactId);
        if (selectedContact) {
          const { data: contactData } = await supabase
            .from("contacts")
            .select("email, name")
            .eq("id", selectedContactId)
            .single();
          contactEmail = contactData?.email;
        }
      }

      const invoiceNumber = generateInvoiceNumber();
      const invoiceData: any = {
        speaker_id: userId,
        contact_id: selectedContactId || null,
        invoice_number: invoiceNumber,
        status: send ? "sent" : "draft",
        issue_date: new Date().toISOString().split("T")[0],
        due_date: dueDate,
        line_items: JSON.stringify(lineItems.filter(item => item.description && item.amount > 0)),
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        notes,
        payment_instructions: paymentInstructions,
        sent_at: send ? new Date().toISOString() : null,
      };

      const { data: newInvoice, error } = await supabase
        .from("invoices")
        .insert(invoiceData)
        .select("id")
        .single();

      if (error) throw error;

      // Send email if requested and contact has email
      if (send && contactEmail) {
        const selectedContact = contacts.find(c => c.id === selectedContactId);
        const invoiceHtml = generateInvoiceEmailBody(invoiceNumber, selectedContact?.name || "Client", total, dueDate);
        
        await sendEmail({
          to: contactEmail,
          subject: `Invoice ${invoiceNumber} from NextMic`,
          body: invoiceHtml,
          relatedType: "invoice",
          relatedId: newInvoice?.id,
        });
      }

      toast.success(send ? "Invoice sent!" : "Invoice saved as draft");
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setLineItems([{ id: crypto.randomUUID(), description: "Speaking Fee", quantity: 1, rate: 0, amount: 0 }]);
      setDueDate(format(addDays(new Date(), 30), "yyyy-MM-dd"));
      setTaxRate(0);
      setNotes("");
      setPaymentInstructions("");
      setSelectedContactId("");
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      toast.error(error.message || "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  };

  const generateInvoiceEmailBody = (invoiceNum: string, clientName: string, amount: number, due: string) => {
    return `Dear ${clientName},

Please find attached Invoice ${invoiceNum} for ${formatCurrency(amount)}.

Payment is due by ${format(new Date(due), "MMMM d, yyyy")}.

${paymentInstructions ? `Payment Instructions:\n${paymentInstructions}\n\n` : ""}${notes ? `Notes:\n${notes}\n\n` : ""}Thank you for your business!`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Invoice
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contact & Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map(contact => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name} {contact.company && `(${contact.company})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Preset Items */}
          <div className="space-y-2">
            <Label>Quick Add</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ITEMS.map((preset, i) => (
                <Button 
                  key={i} 
                  variant="outline" 
                  size="sm"
                  onClick={() => addPresetItem(preset)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {preset.description}
                </Button>
              ))}
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <Label>Line Items</Label>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Description</TableHead>
                  <TableHead className="w-[15%]">Qty</TableHead>
                  <TableHead className="w-[20%]">Rate</TableHead>
                  <TableHead className="w-[20%]">Amount</TableHead>
                  <TableHead className="w-[5%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Input
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                        placeholder="Description"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                        min="1"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.rate}
                        onChange={(e) => updateLineItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(item.amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeLineItem(item.id)}
                        disabled={lineItems.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-medium">Subtotal</TableCell>
                  <TableCell colSpan={2} className="font-medium">{formatCurrency(subtotal)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={2} className="text-right font-medium">Tax Rate (%)</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-20"
                      min="0"
                      max="100"
                    />
                  </TableCell>
                  <TableCell colSpan={2} className="font-medium">{formatCurrency(taxAmount)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-bold text-lg">Total</TableCell>
                  <TableCell colSpan={2} className="font-bold text-lg">{formatCurrency(total)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            <Button variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Line Item
            </Button>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes for the client..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Instructions</Label>
              <Textarea
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                placeholder="Bank details, PayPal, etc..."
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving || emailSending}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving || emailSending}>
            <Send className="h-4 w-4 mr-2" />
            {emailSending ? "Sending..." : "Send Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}