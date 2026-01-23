import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

interface LineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  speakerName: string;
  speakerEmail?: string;
  speakerPhone?: string;
  clientName: string;
  clientCompany?: string;
  clientEmail?: string;
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentInstructions?: string;
  terms?: string;
  notes?: string;
  logoUrl?: string;
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Colors
  const primaryColor: [number, number, number] = [124, 58, 237]; // violet-600
  const textColor: [number, number, number] = [31, 41, 55]; // gray-800
  const mutedColor: [number, number, number] = [107, 114, 128]; // gray-500

  // Header - Speaker Info (left side)
  doc.setFontSize(20);
  doc.setTextColor(...primaryColor);
  doc.setFont("helvetica", "bold");
  doc.text(data.speakerName || "Speaker", 14, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.setFont("helvetica", "normal");
  if (data.speakerEmail) {
    doc.text(data.speakerEmail, 14, yPos);
    yPos += 5;
  }
  if (data.speakerPhone) {
    doc.text(data.speakerPhone, 14, yPos);
  }

  // INVOICE title (right side)
  doc.setFontSize(32);
  doc.setTextColor(...primaryColor);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageWidth - 14, 25, { align: "right" });

  // Invoice details (right side)
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  doc.setFont("helvetica", "normal");
  
  const rightColX = pageWidth - 14;
  doc.text(`Invoice #: ${data.invoiceNumber}`, rightColX, 35, { align: "right" });
  doc.text(`Issue Date: ${format(new Date(data.issueDate), "MMM d, yyyy")}`, rightColX, 42, { align: "right" });
  doc.text(`Due Date: ${format(new Date(data.dueDate), "MMM d, yyyy")}`, rightColX, 49, { align: "right" });

  // Divider
  yPos = 60;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, pageWidth - 14, yPos);

  // Bill To section
  yPos += 15;
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To:", 14, yPos);

  yPos += 7;
  doc.setFontSize(11);
  doc.setTextColor(...textColor);
  doc.setFont("helvetica", "normal");
  doc.text(data.clientName, 14, yPos);
  
  if (data.clientCompany) {
    yPos += 6;
    doc.text(data.clientCompany, 14, yPos);
  }
  if (data.clientEmail) {
    yPos += 6;
    doc.setTextColor(...mutedColor);
    doc.text(data.clientEmail, 14, yPos);
  }

  // Line items table
  yPos += 15;
  
  const tableData = data.lineItems.map(item => [
    item.description,
    item.quantity.toString(),
    formatCurrency(item.rate),
    formatCurrency(item.amount)
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Description", "Qty", "Rate", "Amount"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      textColor: textColor,
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 25, halign: "center" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 35, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  // Get the Y position after the table
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Totals section (right aligned)
  const totalsX = pageWidth - 60;
  const valuesX = pageWidth - 14;

  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  
  doc.text("Subtotal:", totalsX, yPos);
  doc.text(formatCurrency(data.subtotal), valuesX, yPos, { align: "right" });

  if (data.taxRate > 0) {
    yPos += 7;
    doc.text(`Tax (${data.taxRate}%):`, totalsX, yPos);
    doc.text(formatCurrency(data.taxAmount), valuesX, yPos, { align: "right" });
  }

  yPos += 10;
  doc.setDrawColor(...mutedColor);
  doc.line(totalsX - 10, yPos - 3, pageWidth - 14, yPos - 3);
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text("Total Due:", totalsX, yPos + 5);
  doc.text(formatCurrency(data.total), valuesX, yPos + 5, { align: "right" });

  // Payment Instructions
  yPos += 25;
  if (data.paymentInstructions) {
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text("Payment Instructions", 14, yPos);
    
    yPos += 7;
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.setFont("helvetica", "normal");
    const paymentLines = doc.splitTextToSize(data.paymentInstructions, pageWidth - 28);
    doc.text(paymentLines, 14, yPos);
    yPos += paymentLines.length * 5 + 5;
  }

  // Terms
  if (data.terms) {
    yPos += 5;
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text("Terms & Conditions", 14, yPos);
    
    yPos += 7;
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    doc.setFont("helvetica", "normal");
    const termsLines = doc.splitTextToSize(data.terms, pageWidth - 28);
    doc.text(termsLines, 14, yPos);
    yPos += termsLines.length * 4 + 5;
  }

  // Notes
  if (data.notes) {
    yPos += 5;
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text("Notes", 14, yPos);
    
    yPos += 7;
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.setFont("helvetica", "normal");
    const notesLines = doc.splitTextToSize(data.notes, pageWidth - 28);
    doc.text(notesLines, 14, yPos);
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.setFont("helvetica", "italic");
  doc.text("Thank you for your business!", pageWidth / 2, footerY, { align: "center" });

  return doc.output("blob");
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { 
    style: "currency", 
    currency: "USD" 
  }).format(amount);
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}