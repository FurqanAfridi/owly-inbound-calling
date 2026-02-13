import { useState, useEffect } from "react";
import { Mail, Plus, Trash2, Loader2, CheckCircle2, FileText, Edit2, Star, Sparkles, Send, PenTool, Lock, Eye, EyeOff, Monitor, Code2, Palette, History, XCircle, Clock, Maximize2, Minimize2, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { useEmailTemplates, type EmailTemplate } from "@/hooks/useEmailTemplates";
import { useAIEmail } from "@/hooks/useAIEmail";
import { useEmails } from "@/hooks/useEmails";
import { useSendEmail } from "@/hooks/useSendEmail";
import { useEmailLogs } from "@/hooks/useEmailLogs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { convertToHtmlEmail, DESIGN_STYLES, ACCENT_COLORS, type EmailDesignStyle } from "@/lib/htmlEmail";
import { getAvailablePlaceholders } from "@/lib/emailPlaceholders";

interface EmailAddress {
  id: string;
  email: string;
  name?: string | null;
  smtp_password?: string | null;
  is_primary: boolean;
  is_verified?: boolean;
  created_at?: string;
}

export default function Email() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [emailName, setEmailName] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [emails, setEmails] = useState<EmailAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Template management
  const {
    templates,
    loading: templatesLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  } = useEmailTemplates();
  const { generateTemplate, generateEmail, generating: aiGenerating } = useAIEmail();
  const { emails: userEmails, loading: userEmailsLoading } = useEmails();
  const { sendEmail, sending: emailSending } = useSendEmail();
  const { logs: emailLogs, loading: emailLogsLoading } = useEmailLogs(100);
  const [emailLogsFilter, setEmailLogsFilter] = useState<"all" | "sent" | "failed" | "pending">("all");
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templatePreviewMode, setTemplatePreviewMode] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [composePreviewMode, setComposePreviewMode] = useState(false);
  const [deleteTemplateDialogOpen, setDeleteTemplateDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    subject: "",
    body: "",
    description: "",
    is_default: false,
    accent_color: "#4F46E5",
    design_style: "modern" as EmailDesignStyle,
    company_name: "",
  });
  const [aiSettings, setAiSettings] = useState({
    emailType: "follow-up" as "follow-up" | "thank-you" | "appointment" | "custom",
    tone: "professional" as "professional" | "friendly" | "casual" | "formal",
  });
  
  // Compose Email state
  const [composeForm, setComposeForm] = useState({
    fromEmail: "",
    toEmail: "",
    subject: "",
    body: "",
    contactName: "",
    phoneNumber: "",
    companyName: "",
    accentColor: "#4F46E5",
    designStyle: "modern" as EmailDesignStyle,
    senderCompanyName: "",
  });
  const [composeAiSettings, setComposeAiSettings] = useState({
    emailType: "follow-up" as "follow-up" | "thank-you" | "appointment" | "custom",
    tone: "professional" as "professional" | "friendly" | "casual" | "formal",
  });

  // Fetch existing emails from database
  useEffect(() => {
    const fetchEmails = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("user_emails")
          .select("*")
          .eq("user_id", user.id)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) {
          // If table doesn't exist, don't show primary email
          if (error.code === "PGRST116" || error.message?.includes("does not exist")) {
            setEmails([]);
          } else {
            throw error;
          }
        } else if (data && data.length > 0) {
          // Filter out primary emails and only show emails with SMTP configured
          const smtpEmails = data.filter(
            (e: EmailAddress) => !e.is_primary && e.smtp_password && e.smtp_password.trim() !== ""
          );
          setEmails(smtpEmails);
        } else {
          // No emails in database, initialize with user's email if available
          if (user.email) {
            // Try to insert user's primary email
            const { data: insertedData, error: insertError } = await supabase
              .from("user_emails")
              .insert({
                user_id: user.id,
                email: user.email,
                name: "Primary Email",
                is_primary: true,
                is_verified: false,
              })
              .select()
              .single();

            if (insertedData && !insertedData.is_primary && insertedData.smtp_password) {
              setEmails([insertedData]);
            }
          }
        }
      } catch (error) {
        // Removed console.error for security
        toast({
          title: "Error",
          description: "Failed to load email addresses",
          variant: "destructive",
        });
        // Don't show primary email as fallback
        setEmails([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEmails();
  }, [user]);

  // Initialize compose form with first SMTP email
  useEffect(() => {
    if (userEmails.length > 0 && !composeForm.fromEmail) {
      // Only use emails with SMTP password configured
      const smtpEmail = userEmails.find((e) => e.smtp_password && !e.is_primary) || userEmails.find((e) => e.smtp_password);
      setComposeForm((prev) => ({
        ...prev,
        fromEmail: smtpEmail?.email || "",
      }));
    }
  }, [userEmails, composeForm.fromEmail]);

  const handleAddEmail = async () => {
    if (!user) return;

    if (!email.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (!smtpPassword.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter the SMTP password for this email",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicates
    if (emails.some(e => e.email.toLowerCase() === email.trim().toLowerCase())) {
      toast({
        title: "Duplicate Email",
        description: "This email address is already added",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("user_emails")
        .insert({
          user_id: user.id,
          email: email.trim(),
          name: emailName.trim() || null,
          smtp_password: smtpPassword.trim(),
          is_primary: false,
          is_verified: false,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") { // Unique constraint violation
          toast({
            title: "Duplicate Email",
            description: "This email address is already added",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      if (data) {
        // Only add to list if it has SMTP password and is not primary
        if (!data.is_primary && data.smtp_password) {
          setEmails((prev) => [...prev, data]);
        }
        setEmail("");
        setEmailName("");
        setSmtpPassword("");
        setShowSmtpPassword(false);
        toast({
          title: "Email Added",
          description: "Email address has been added successfully",
        });
      }
    } catch (error: any) {
      // Removed console.error for security
      toast({
        title: "Error",
        description: error.message || "Failed to add email address",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (emailId: string, isPrimary: boolean) => {
    if (!user) return;

    if (isPrimary) {
      toast({
        title: "Cannot Delete",
        description: "Cannot delete primary email address",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("user_emails")
        .delete()
        .eq("id", emailId)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      setEmails((prev) => prev.filter((e) => e.id !== emailId));
      toast({
        title: "Email Removed",
        description: "Email address has been removed",
      });
    } catch (error: any) {
      // Removed console.error for security
      toast({
        title: "Error",
        description: error.message || "Failed to remove email address",
        variant: "destructive",
      });
    }
  };

  const handleSetPrimary = async (emailId: string) => {
    if (!user) return;

    try {
      // First, unset all primary emails
      await supabase
        .from("user_emails")
        .update({ is_primary: false })
        .eq("user_id", user.id)
        .eq("is_primary", true);

      // Then set the selected email as primary
      const { error } = await supabase
        .from("user_emails")
        .update({ is_primary: true })
        .eq("id", emailId)
        .eq("user_id", user.id);

      if (error) throw error;

      // Update local state
      setEmails((prev) =>
        prev.map((e) => ({
          ...e,
          is_primary: e.id === emailId,
        }))
      );

      toast({
        title: "Primary Email Updated",
        description: "Primary email address has been updated",
      });
    } catch (error: any) {
      // Removed console.error for security
      toast({
        title: "Error",
        description: error.message || "Failed to update primary email",
        variant: "destructive",
      });
    }
  };

  const openTemplateDialog = (template?: EmailTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        name: template.name,
        subject: template.subject,
        body: template.body,
        description: template.description || "",
        is_default: template.is_default,
        accent_color: template.accent_color || "#4F46E5",
        design_style: (template.design_style || "modern") as EmailDesignStyle,
        company_name: template.company_name || "",
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm({
        name: "",
        subject: "",
        body: "",
        description: "",
        is_default: false,
        accent_color: "#4F46E5",
        design_style: "modern" as EmailDesignStyle,
        company_name: "",
      });
    }
    setTemplatePreviewMode(false);
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name || !templateForm.subject || !templateForm.body) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (editingTemplate) {
      await updateTemplate(editingTemplate.id, templateForm);
    } else {
      await createTemplate(templateForm);
    }
    setTemplateDialogOpen(false);
  };

  const handleGenerateWithAI = async () => {
    if (!templateForm.name.trim()) {
      toast({
        title: "Template Name Required",
        description: "Please enter a template name first",
        variant: "destructive",
      });
      return;
    }

    const generated = await generateTemplate({
      name: templateForm.name,
      description: templateForm.description,
      emailType: aiSettings.emailType,
      tone: aiSettings.tone,
    });

    if (generated) {
      setTemplateForm({
        ...templateForm,
        subject: generated.subject,
        body: generated.body,
      });
      toast({
        title: "Template Generated",
        description: "AI has generated your email template. You can edit it as needed.",
      });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    setTemplateToDelete(id);
    setDeleteTemplateDialogOpen(true);
  };

  const confirmDeleteTemplate = async () => {
    if (templateToDelete) {
      await deleteTemplate(templateToDelete);
      setDeleteTemplateDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const availableVariables = [
    { key: "contact_name", label: "Contact Name" },
    { key: "phone_number", label: "Phone Number" },
    { key: "company_name", label: "Company Name" },
    { key: "call_date", label: "Call Date" },
  ];
  
  const bracketPlaceholders = getAvailablePlaceholders();

  return (
    <div className="space-y-8 pb-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Email Management</h1>
              <p className="text-slate-500 text-base">Manage your email addresses, templates, and compose emails</p>
            </div>
          </div>

          <Tabs defaultValue="addresses" className="space-y-6">
            <TabsList>
              <TabsTrigger value="addresses">Email Addresses</TabsTrigger>
              <TabsTrigger value="templates">Email Templates</TabsTrigger>
              <TabsTrigger value="compose">Compose Email</TabsTrigger>
              <TabsTrigger value="logs">Email Logs</TabsTrigger>
            </TabsList>

            {/* Email Addresses Tab */}
            <TabsContent value="addresses" className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Video Tutorial Box - Side Panel */}
                <div className={`transition-all duration-300 ${isVideoExpanded ? 'md:col-span-3 order-first' : 'md:col-span-1'}`}>
                  <Card className="border-slate-200 shadow-sm sticky top-4">
                    <CardHeader className="border-b border-slate-100 pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                          <Play className="h-4 w-4 text-blue-600" />
                          <span className="text-sm">Video Tutorial</span>
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsVideoExpanded(!isVideoExpanded)}
                          className="h-7 w-7 p-0"
                        >
                          {isVideoExpanded ? (
                            <Minimize2 className="h-4 w-4" />
                          ) : (
                            <Maximize2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <CardDescription className="text-xs text-slate-500 mt-1">
                        {isVideoExpanded ? "Click to minimize" : "Click to enlarge"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                      <div className="rounded-lg overflow-hidden border border-slate-200 bg-black/5 shadow-sm">
                        <video
                          controls
                          muted
                          className={`w-full h-auto ${isVideoExpanded ? 'max-h-[600px]' : 'max-h-[200px]'}`}
                          preload="metadata"
                        >
                          <source src="https://fsotzwtqsrpymqasksej.supabase.co/storage/v1/object/public/vidoesdemo/smtp.mp4" type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                      </div>
                      {!isVideoExpanded && (
                        <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-1.5">
                          <p className="text-xs font-semibold text-slate-900">Quick Steps:</p>
                          <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
                            <li>Enter email address</li>
                            <li>Enter SMTP password</li>
                            <li>Click "Add Email"</li>
                          </ol>
                        </div>
                      )}
                      {isVideoExpanded && (
                        <div className="bg-white/80 border border-slate-200 rounded-lg p-4 space-y-2">
                          <p className="text-sm font-semibold text-slate-900">Detailed Instructions:</p>
                          <ol className="text-sm text-slate-700 space-y-1.5 list-decimal list-inside">
                            <li>Enter a name for your email address (optional) - e.g., "Support Email"</li>
                            <li>Enter your email address (e.g., support@example.com)</li>
                            <li>Enter your SMTP password or App Password (required for sending emails)</li>
                            <li>Click "Add Email" to save the email address to your account</li>
                            <li>Use an App Password if your email provider requires it (e.g., Gmail App Password)</li>
                          </ol>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Main Content - Forms */}
                <div className={`transition-all duration-300 ${isVideoExpanded ? 'md:col-span-3 order-last' : 'md:col-span-2'}`}>
                  <div className="grid md:grid-cols-2 gap-6">
            {/* Add Email Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Add Email Address
                </CardTitle>
                <CardDescription>
                  Add a new email address to your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email_name">
                    Name (Optional)
                  </Label>
                  <Input
                    id="email_name"
                    placeholder="e.g., Support Email"
                    value={emailName}
                    onChange={(e) => setEmailName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email_address">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email_address"
                    type="email"
                    placeholder="e.g., support@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp_password">
                    SMTP Password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="smtp_password"
                      type={showSmtpPassword ? "text" : "password"}
                      placeholder="Enter SMTP / App password"
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      className="pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer p-0"
                    >
                      {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use an App Password if your provider requires it (e.g., Gmail App Password)
                  </p>
                </div>

                <Button
                  onClick={handleAddEmail}
                  disabled={!email.trim() || !smtpPassword.trim() || saving}
                  className="w-full"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Email
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Emails List */}
            <Card>
              <CardHeader>
                <CardTitle>Your Emails</CardTitle>
                <CardDescription>
                  {emails.length} SMTP email address(es)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : emails.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No emails added yet</p>
                    <p className="text-xs mt-1">Add emails to get started</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {emails.map((emailItem) => (
                        <Card key={emailItem.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Mail className="h-4 w-4 text-primary" />
                                  <span className="font-semibold">
                                    {emailItem.name || emailItem.email}
                                  </span>
                                  {emailItem.smtp_password && (
                                    <Badge variant="outline" className="text-xs gap-1">
                                      <Lock className="h-3 w-3" />
                                      SMTP
                                    </Badge>
                                  )}
                                  {emailItem.is_verified && (
                                    <Badge variant="outline" className="text-xs gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Verified
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {emailItem.email}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(emailItem.id, emailItem.is_primary)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Email Templates Tab */}
            <TabsContent value="templates" className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-semibold">Email Templates</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Create reusable email templates with variables
                  </p>
                </div>
                <Button onClick={() => openTemplateDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              </div>

              {/* Available Variables Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Available Variables</CardTitle>
                  <CardDescription className="text-xs">
                    <div className="space-y-2">
                      <p className="text-xs font-medium">Template variables: {availableVariables.map(v => `{{${v.key}}}`).join(", ")}</p>
                      <p className="text-xs font-medium text-muted-foreground">
                        Auto-fill placeholders: {bracketPlaceholders.slice(0, 5).map(p => p.placeholder).join(", ")}...
                      </p>
                    </div>
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Templates List */}
              {templatesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : templates.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No templates created yet</p>
                    <p className="text-xs mt-1">Create your first email template to get started</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <Card key={template.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{template.name}</CardTitle>
                              {template.is_default && (
                                <Badge variant="default" className="text-xs">
                                  <Star className="h-3 w-3 mr-1" />
                                  Default
                                </Badge>
                              )}
                            </div>
                            {template.description && (
                              <CardDescription className="mt-1">
                                {template.description}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Subject</Label>
                          <p className="text-sm font-medium mt-1">{template.subject}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Preview</Label>
                          <div
                            className="mt-2 border rounded-lg overflow-hidden bg-white"
                            style={{ height: 160 }}
                          >
                            <iframe
                              srcDoc={convertToHtmlEmail(template.subject, template.body, { previewMode: true })}
                              title={`Preview: ${template.name}`}
                              className="w-full h-full border-0"
                              sandbox="allow-same-origin"
                              style={{ pointerEvents: "none", transform: "scale(0.5)", transformOrigin: "top left", width: "200%", height: "200%" }}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPreviewTemplate(template);
                              setPreviewDialogOpen(true);
                            }}
                            className="flex-1"
                          >
                            <Monitor className="h-3 w-3 mr-2" />
                            Preview
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openTemplateDialog(template)}
                            className="flex-1"
                          >
                            <Edit2 className="h-3 w-3 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Compose Email Tab */}
            <TabsContent value="compose" className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Compose Email</h2>
                <p className="text-muted-foreground text-sm">
                  Write and send emails with AI assistance
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PenTool className="h-5 w-5" />
                    New Email
                  </CardTitle>
                  <CardDescription>
                    Compose a new email with optional AI generation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="compose_from_email">
                        From Email <span className="text-destructive">*</span>
                      </Label>
                      {userEmailsLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Loading emails...</span>
                        </div>
                      ) : userEmails.length === 0 ? (
                        <div className="text-sm text-muted-foreground p-3 border rounded-md">
                          No email addresses configured. Please add an email address first.
                        </div>
                      ) : (
                        <Select
                          value={composeForm.fromEmail}
                          onValueChange={(value) => setComposeForm({ ...composeForm, fromEmail: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select email address" />
                          </SelectTrigger>
                          <SelectContent>
                            {userEmails
                              .filter((email) => email.smtp_password && !email.is_primary)
                              .map((email) => (
                                <SelectItem key={email.id} value={email.email}>
                                  {email.name || email.email}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="compose_to_email">
                        To Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="compose_to_email"
                        type="email"
                        placeholder="recipient@example.com"
                        value={composeForm.toEmail}
                        onChange={(e) => setComposeForm({ ...composeForm, toEmail: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Optional Lead Information */}
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <Label className="text-sm font-semibold mb-3 block">Optional: Lead Information (for AI generation)</Label>
                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="compose_contact_name" className="text-xs">Contact Name</Label>
                        <Input
                          id="compose_contact_name"
                          placeholder="John Doe"
                          value={composeForm.contactName}
                          onChange={(e) => setComposeForm({ ...composeForm, contactName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="compose_phone_number" className="text-xs">Phone Number</Label>
                        <Input
                          id="compose_phone_number"
                          placeholder="+1234567890"
                          value={composeForm.phoneNumber}
                          onChange={(e) => setComposeForm({ ...composeForm, phoneNumber: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="compose_company_name" className="text-xs">Company Name</Label>
                        <Input
                          id="compose_company_name"
                          placeholder="Acme Corp"
                          value={composeForm.companyName}
                          onChange={(e) => setComposeForm({ ...composeForm, companyName: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* AI Generation Section */}
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Generate with AI
                      </Label>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3 mb-3">
                      <div className="space-y-2">
                        <Label htmlFor="compose_ai_email_type" className="text-xs">Email Type</Label>
                        <Select
                          value={composeAiSettings.emailType}
                          onValueChange={(value: any) => setComposeAiSettings({ ...composeAiSettings, emailType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="follow-up">Follow-up</SelectItem>
                            <SelectItem value="thank-you">Thank You</SelectItem>
                            <SelectItem value="appointment">Appointment</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="compose_ai_tone" className="text-xs">Tone</Label>
                        <Select
                          value={composeAiSettings.tone}
                          onValueChange={(value: any) => setComposeAiSettings({ ...composeAiSettings, tone: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                            <SelectItem value="formal">Formal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        const generated = await generateEmail({
                          leadInfo: {
                            contact_name: composeForm.contactName || undefined,
                            phone_number: composeForm.phoneNumber || undefined,
                            company_name: composeForm.companyName || undefined,
                            call_date: new Date().toLocaleDateString(),
                          },
                          emailType: composeAiSettings.emailType,
                          tone: composeAiSettings.tone,
                        });

                        if (generated) {
                          setComposeForm({
                            ...composeForm,
                            subject: generated.subject,
                            body: generated.body,
                          });
                        }
                      }}
                      disabled={aiGenerating || !composeForm.toEmail.trim()}
                      className="w-full"
                    >
                      {aiGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate Email with AI
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Design Style for Compose */}
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      Design Style
                    </Label>
                    <div className="space-y-2">
                      <Label className="text-xs">Layout</Label>
                      <div className="grid grid-cols-5 gap-2">
                        {DESIGN_STYLES.map((s: { value: EmailDesignStyle; label: string; description: string }) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => setComposeForm({ ...composeForm, designStyle: s.value })}
                            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                              composeForm.designStyle === s.value
                                ? "border-primary bg-primary/10 text-primary shadow-sm"
                                : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                            }`}
                            title={s.description}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Accent Color</Label>
                      <div className="flex flex-wrap gap-2">
                        {ACCENT_COLORS.map((c: { value: string; label: string }) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setComposeForm({ ...composeForm, accentColor: c.value })}
                            className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                              composeForm.accentColor === c.value
                                ? "border-foreground scale-110 shadow-md"
                                : "border-transparent hover:scale-105"
                            }`}
                            style={{ backgroundColor: c.value }}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="compose_sender_company" className="text-xs">Company Name (shown in header)</Label>
                      <Input
                        id="compose_sender_company"
                        placeholder="e.g., Acme Corp"
                        value={composeForm.senderCompanyName}
                        onChange={(e) => setComposeForm({ ...composeForm, senderCompanyName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="compose_subject">
                      Subject <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="compose_subject"
                      placeholder="Email subject"
                      value={composeForm.subject}
                      onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="compose_body">
                        Message <span className="text-destructive">*</span>
                      </Label>
                      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => setComposePreviewMode(false)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all border-none cursor-pointer ${
                            !composePreviewMode
                              ? "bg-background text-foreground shadow-sm"
                              : "bg-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Code2 className="h-3 w-3 inline mr-1.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setComposePreviewMode(true)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all border-none cursor-pointer ${
                            composePreviewMode
                              ? "bg-background text-foreground shadow-sm"
                              : "bg-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Monitor className="h-3 w-3 inline mr-1.5" />
                          Preview
                        </button>
                      </div>
                    </div>

                    {!composePreviewMode ? (
                      <Textarea
                        id="compose_body"
                        placeholder="Write your email message here..."
                        rows={12}
                        value={composeForm.body}
                        onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
                      />
                    ) : (
                      <div className="border rounded-lg overflow-hidden bg-white" style={{ minHeight: 320 }}>
                        {composeForm.body.trim() ? (
                          <iframe
                            srcDoc={convertToHtmlEmail(
                              composeForm.subject || "Email Subject",
                              composeForm.body,
                              {
                                previewMode: false,
                                style: composeForm.designStyle,
                                accentColor: composeForm.accentColor,
                                companyName: composeForm.senderCompanyName,
                              }
                            )}
                            title="Compose Preview"
                            className="w-full border-0"
                            style={{ height: 380 }}
                            sandbox="allow-same-origin"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">
                            Write some content to see the preview
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const smtpEmail = userEmails.find((e) => e.smtp_password && !e.is_primary) || userEmails.find((e) => e.smtp_password);
                        setComposeForm({
                          fromEmail: smtpEmail?.email || "",
                          toEmail: "",
                          subject: "",
                          body: "",
                          contactName: "",
                          phoneNumber: "",
                          companyName: "",
                          accentColor: "#4F46E5",
                          designStyle: "modern",
                          senderCompanyName: "",
                        });
                        setComposePreviewMode(false);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!composeForm.fromEmail || !composeForm.toEmail || !composeForm.subject || !composeForm.body) {
                          toast({
                            title: "Validation Error",
                            description: "Please fill in all required fields",
                            variant: "destructive",
                          });
                          return;
                        }

                        // Get the SMTP password for the selected from email
                        const selectedEmail = userEmails.find((e) => e.email === composeForm.fromEmail);
                        const result = await sendEmail({
                          fromEmail: composeForm.fromEmail,
                          toEmail: composeForm.toEmail,
                          toPhoneNumber: composeForm.phoneNumber || undefined,
                          subject: composeForm.subject,
                          body: composeForm.body,
                          smtpPassword: selectedEmail?.smtp_password || undefined,
                          designStyle: composeForm.designStyle,
                          accentColor: composeForm.accentColor,
                          companyName: composeForm.senderCompanyName,
                        });

                        if (result.success) {
                          const smtpEmail = userEmails.find((e) => e.smtp_password && !e.is_primary) || userEmails.find((e) => e.smtp_password);
                          setComposeForm({
                            fromEmail: smtpEmail?.email || "",
                            toEmail: "",
                            subject: "",
                            body: "",
                            contactName: "",
                            phoneNumber: "",
                            companyName: "",
                            accentColor: "#4F46E5",
                            designStyle: "modern",
                            senderCompanyName: "",
                          });
                          setComposePreviewMode(false);
                        }
                      }}
                      disabled={emailSending || !composeForm.fromEmail || !composeForm.toEmail || !composeForm.subject || !composeForm.body}
                    >
                      {emailSending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send Email
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Email Logs Tab */}
            <TabsContent value="logs" className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold flex items-center gap-2">
                  <History className="h-6 w-6" />
                  Email Logs
                </h2>
                <p className="text-muted-foreground text-sm">
                  View all emails you've sent, including their status and details
                </p>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Sent Emails</CardTitle>
                      <CardDescription>
                        {emailLogs.filter(log => emailLogsFilter === "all" || log.status === emailLogsFilter).length} email{emailLogs.filter(log => emailLogsFilter === "all" || log.status === emailLogsFilter).length !== 1 ? 's' : ''} {emailLogsFilter !== "all" ? `(${emailLogsFilter})` : ""}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={emailLogsFilter} onValueChange={(value: any) => setEmailLogsFilter(value)}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="sent">Sent</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {emailLogsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : emailLogs.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No emails sent yet</p>
                      <p className="text-xs mt-1">Start sending emails to see them here</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[600px]">
                      <div className="space-y-3">
                        {emailLogs
                          .filter((log) => emailLogsFilter === "all" || log.status === emailLogsFilter)
                          .map((log) => (
                          <Card key={log.id} className="border-l-4 border-l-primary/50">
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge
                                        variant={
                                          log.status === "sent"
                                            ? "default"
                                            : log.status === "failed"
                                            ? "destructive"
                                            : "secondary"
                                        }
                                        className="flex items-center gap-1"
                                      >
                                        {log.status === "sent" && (
                                          <CheckCircle2 className="h-3 w-3" />
                                        )}
                                        {log.status === "failed" && (
                                          <XCircle className="h-3 w-3" />
                                        )}
                                        {log.status === "pending" && (
                                          <Clock className="h-3 w-3" />
                                        )}
                                        {log.status || "pending"}
                                      </Badge>
                                      {log.sent_at && (
                                        <span className="text-xs text-muted-foreground">
                                          {new Date(log.sent_at).toLocaleString()}
                                        </span>
                                      )}
                                    </div>
                                    <div>
                                      <Label className="text-xs text-muted-foreground">Subject</Label>
                                      <p className="text-sm font-medium mt-1">{log.subject}</p>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-3">
                                      <div>
                                        <Label className="text-xs text-muted-foreground">From</Label>
                                        <p className="text-sm mt-1 break-all">{log.from_email}</p>
                                      </div>
                                      <div>
                                        <Label className="text-xs text-muted-foreground">To</Label>
                                        <p className="text-sm mt-1 break-all">{log.to_email}</p>
                                      </div>
                                    </div>
                                    {log.to_phone_number && (
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Phone Number</Label>
                                        <p className="text-sm mt-1">{log.to_phone_number}</p>
                                      </div>
                                    )}
                                    {log.error_message && (
                                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                                        <Label className="text-xs text-destructive font-semibold">Error Message</Label>
                                        <p className="text-sm text-destructive mt-1">{log.error_message}</p>
                                      </div>
                                    )}
                                    {log.body && (
                                      <details className="mt-2">
                                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                          View Email Body
                                        </summary>
                                        <div className="mt-2 p-3 rounded-lg bg-muted/50 border text-sm max-h-40 overflow-y-auto">
                                          <pre className="whitespace-pre-wrap font-sans">{log.body}</pre>
                                        </div>
                                      </details>
                                    )}
                                    <div className="text-xs text-muted-foreground pt-2 border-t">
                                      Created: {new Date(log.created_at).toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Full Preview Dialog */}
          <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  {previewTemplate?.name || "Email Preview"}
                </DialogTitle>
                <DialogDescription>
                  Preview how this email will look in the recipient's inbox
                </DialogDescription>
              </DialogHeader>
              <div className="px-6 pb-6">
                {previewTemplate && (
                  <div className="border rounded-lg overflow-hidden bg-white shadow-inner">
                    <iframe
                      srcDoc={convertToHtmlEmail(
                        previewTemplate.subject,
                        previewTemplate.body,
                        { previewMode: true }
                      )}
                      title={`Full Preview: ${previewTemplate.name}`}
                      className="w-full border-0"
                      style={{ height: "60vh" }}
                      sandbox="allow-same-origin"
                    />
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Template Dialog */}
          <Dialog open={templateDialogOpen} onOpenChange={(open) => {
            setTemplateDialogOpen(open);
            if (!open) setTemplatePreviewMode(false);
          }}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? "Edit Template" : "Create Email Template"}
                </DialogTitle>
                <DialogDescription>
                  Create a reusable email template. Use variables like {"{{contact_name}}"} and {"{{phone_number}}"}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="template_name">
                    Template Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="template_name"
                    placeholder="e.g., Follow-up Email"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template_description">Description (Optional)</Label>
                  <Input
                    id="template_description"
                    placeholder="Brief description of this template"
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  />
                </div>

                {!editingTemplate && (
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Generate with AI
                      </Label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="ai_email_type" className="text-xs">Email Type</Label>
                        <Select
                          value={aiSettings.emailType}
                          onValueChange={(value: any) => setAiSettings({ ...aiSettings, emailType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="follow-up">Follow-up</SelectItem>
                            <SelectItem value="thank-you">Thank You</SelectItem>
                            <SelectItem value="appointment">Appointment</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ai_tone" className="text-xs">Tone</Label>
                        <Select
                          value={aiSettings.tone}
                          onValueChange={(value: any) => setAiSettings({ ...aiSettings, tone: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                            <SelectItem value="formal">Formal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGenerateWithAI}
                      disabled={aiGenerating || !templateForm.name.trim()}
                      className="w-full"
                    >
                      {aiGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate Template with AI
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Design Customization */}
                <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Design Style
                  </Label>

                  {/* Style Presets */}
                  <div className="space-y-2">
                    <Label className="text-xs">Layout</Label>
                    <div className="grid grid-cols-5 gap-2">
                      {DESIGN_STYLES.map((s: { value: EmailDesignStyle; label: string; description: string }) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setTemplateForm({ ...templateForm, design_style: s.value })}
                          className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                            templateForm.design_style === s.value
                              ? "border-primary bg-primary/10 text-primary shadow-sm"
                              : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                          }`}
                          title={s.description}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Accent Color */}
                  <div className="space-y-2">
                    <Label className="text-xs">Accent Color</Label>
                    <div className="flex flex-wrap gap-2">
                      {ACCENT_COLORS.map((c: { value: string; label: string }) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setTemplateForm({ ...templateForm, accent_color: c.value })}
                          className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${
                            templateForm.accent_color === c.value
                              ? "border-foreground scale-110 shadow-md"
                              : "border-transparent hover:scale-105"
                          }`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Company Name */}
                  <div className="space-y-2">
                    <Label htmlFor="template_company_name" className="text-xs">Company Name (shown in header)</Label>
                    <Input
                      id="template_company_name"
                      placeholder="e.g., Acme Corp"
                      value={templateForm.company_name}
                      onChange={(e) => setTemplateForm({ ...templateForm, company_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template_subject">
                    Subject <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="template_subject"
                    placeholder="e.g., Follow-up: {{contact_name}}"
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Template variables: {availableVariables.map(v => `{{${v.key}}}`).join(", ")}</p>
                    <p className="text-xs text-muted-foreground">
                      Auto-fill placeholders: {bracketPlaceholders.slice(0, 4).map(p => p.placeholder).join(", ")}...
                    </p>
                  </div>
                </div>

                {/* Edit / Preview Toggle */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>
                      Body <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                      <button
                        type="button"
                        onClick={() => setTemplatePreviewMode(false)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all border-none cursor-pointer ${
                          !templatePreviewMode
                            ? "bg-background text-foreground shadow-sm"
                            : "bg-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Code2 className="h-3 w-3 inline mr-1.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemplatePreviewMode(true)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all border-none cursor-pointer ${
                          templatePreviewMode
                            ? "bg-background text-foreground shadow-sm"
                            : "bg-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Monitor className="h-3 w-3 inline mr-1.5" />
                        Preview
                      </button>
                    </div>
                  </div>

                  {!templatePreviewMode ? (
                    <>
                      <Textarea
                        id="template_body"
                        placeholder="Hello {{contact_name}},&#10;&#10;Thank you for your interest..."
                        rows={10}
                        value={templateForm.body}
                        onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                      />
                      <div className="space-y-1">
                        <p className="text-xs font-medium">Template variables: {availableVariables.map(v => `{{${v.key}}}`).join(", ")}</p>
                        <p className="text-xs text-muted-foreground">
                          Auto-fill placeholders: {bracketPlaceholders.slice(0, 4).map(p => p.placeholder).join(", ")}...
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="border rounded-lg overflow-hidden bg-white" style={{ minHeight: 400 }}>
                      {templateForm.body.trim() ? (
                        <iframe
                          srcDoc={convertToHtmlEmail(
                            templateForm.subject || "Email Subject",
                            templateForm.body,
                            {
                              previewMode: true,
                              style: templateForm.design_style,
                              accentColor: templateForm.accent_color,
                              companyName: templateForm.company_name,
                            }
                          )}
                          title="Template Preview"
                          className="w-full border-0"
                          style={{ height: 450 }}
                          sandbox="allow-same-origin"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-[400px] text-muted-foreground text-sm">
                          Write some content in the body to see the preview
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="template_default"
                    checked={templateForm.is_default}
                    onChange={(e) => setTemplateForm({ ...templateForm, is_default: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="template_default" className="text-sm font-normal cursor-pointer">
                    Set as default template
                  </Label>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setTemplateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveTemplate}>
                    {editingTemplate ? "Update Template" : "Create Template"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Template Confirmation Dialog */}
          <Dialog open={deleteTemplateDialogOpen} onOpenChange={setDeleteTemplateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Template</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this template? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteTemplateDialogOpen(false);
                    setTemplateToDelete(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDeleteTemplate}
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
  );
}
