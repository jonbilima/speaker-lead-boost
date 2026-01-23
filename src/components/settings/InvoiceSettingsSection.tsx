import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, Save, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface InvoiceSettingsSectionProps {
  userId: string;
}

export function InvoiceSettingsSection({ userId }: InvoiceSettingsSectionProps) {
  const [logoUrl, setLogoUrl] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [terms, setTerms] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("invoice_logo_url, default_payment_instructions, default_invoice_terms, default_tax_rate")
        .eq("id", userId)
        .single();

      if (data) {
        setLogoUrl(data.invoice_logo_url || "");
        setPaymentInstructions(data.default_payment_instructions || "");
        setTerms(data.default_invoice_terms || "");
        setTaxRate(data.default_tax_rate?.toString() || "0");
      }
    };

    fetchSettings();
  }, [userId]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${userId}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("speaker-assets")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("speaker-assets")
        .getPublicUrl(filePath);

      setLogoUrl(publicUrl);
      
      // Save immediately
      await supabase
        .from("profiles")
        .update({ invoice_logo_url: publicUrl })
        .eq("id", userId);

      toast({
        title: "Logo uploaded",
        description: "Your invoice logo has been updated",
      });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    setLogoUrl("");
    await supabase
      .from("profiles")
      .update({ invoice_logo_url: null })
      .eq("id", userId);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          invoice_logo_url: logoUrl || null,
          default_payment_instructions: paymentInstructions || null,
          default_invoice_terms: terms || null,
          default_tax_rate: parseFloat(taxRate) || 0,
        })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Your invoice settings have been updated",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Invoice Settings</h3>
      </div>

      <div className="space-y-4">
        {/* Logo Upload */}
        <div>
          <Label>Invoice Logo</Label>
          <div className="mt-2 flex items-center gap-4">
            {logoUrl ? (
              <div className="relative">
                <img 
                  src={logoUrl} 
                  alt="Invoice logo" 
                  className="h-16 w-auto object-contain border rounded"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={handleRemoveLogo}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="h-16 w-32 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground text-sm">
                No logo
              </div>
            )}
            <div>
              <Input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-upload"
              />
              <Button 
                variant="outline" 
                size="sm" 
                asChild
                disabled={isUploading}
              >
                <label htmlFor="logo-upload" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? "Uploading..." : "Upload Logo"}
                </label>
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Recommended: 200x50px PNG or SVG
          </p>
        </div>

        {/* Default Tax Rate */}
        <div>
          <Label htmlFor="taxRate">Default Tax Rate (%)</Label>
          <Input
            id="taxRate"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            className="mt-1 w-32"
          />
        </div>

        {/* Default Payment Instructions */}
        <div>
          <Label htmlFor="paymentInstructions">Default Payment Instructions</Label>
          <Textarea
            id="paymentInstructions"
            placeholder="Bank transfer details, PayPal info, etc."
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
            rows={3}
            className="mt-1"
          />
        </div>

        {/* Default Terms */}
        <div>
          <Label htmlFor="terms">Default Terms & Conditions</Label>
          <Textarea
            id="terms"
            placeholder="Payment due within 30 days. Late payments subject to 1.5% monthly interest."
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={3}
            className="mt-1"
          />
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save Invoice Settings"}
        </Button>
      </div>
    </Card>
  );
}