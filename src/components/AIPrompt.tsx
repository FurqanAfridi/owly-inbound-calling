import { useState, useEffect } from "react";
import { Sparkles, FileText, Loader2, Copy, Save, Building2, List, Edit2, Trash2, ChevronDown, ChevronUp, Upload, X, AlertCircle, Settings2, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useAIPrompts } from "@/hooks/useAIPrompts";
import { supabase } from "@/lib/supabase";
import { uploadFile } from "@/lib/fileUpload";
import { extractDocumentProfile, generatePromptFromProfile, formatRawPrompt } from "@/services/aiPromptService";
import type { AgentPromptProfile } from "@/types/aiPrompt";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";

export default function AIPrompt() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { prompts, loading: promptsLoading, createPrompt, updatePrompt, deletePrompt, getUserPrompts } = useAIPrompts();

  // Form state
  const [formData, setFormData] = useState<Partial<AgentPromptProfile>>({
    companyName: "", companyAddress: "", companyWebsite: "", companyEmail: "", companyPhone: "",
    businessIndustry: "", businessDescription: "", agentPurpose: "", callType: "Sales",
    targetAudience: "", callGoal: "Book Appointment", services: [], pricingInfo: "",
    businessHours: "", bookingMethod: "", appointmentRules: "", escalationProcess: "",
    requiredCustomerFields: [], faqs: [], objections: [], policies: [], tone: "Friendly", languages: [],
  });

  // Advanced section toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Document upload
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<{ extractedProfile: Partial<AgentPromptProfile>; missingFields: string[] } | null>(null);

  // Prompt generation
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [generatedWelcomeMessages, setGeneratedWelcomeMessages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Format Prompt
  const [promptToFormat, setPromptToFormat] = useState("");
  const [formattedPrompt, setFormattedPrompt] = useState("");
  const [isFormatting, setIsFormatting] = useState(false);

  // Save Dialog
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savePromptName, setSavePromptName] = useState("");
  const [savePromptCategory, setSavePromptCategory] = useState("general");
  const [savePromptContent, setSavePromptContent] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState("generate");

  // Edit Dialog
  const [editingPrompt, setEditingPrompt] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPromptName, setEditPromptName] = useState("");
  const [editPromptCategory, setEditPromptCategory] = useState("general");
  const [editPromptContent, setEditPromptContent] = useState("");
  const [editBeginMessage, setEditBeginMessage] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());

  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<string | null>(null);

  // List input helpers
  const [newService, setNewService] = useState("");
  const [newFaq, setNewFaq] = useState("");
  const [newObjection, setNewObjection] = useState("");
  const [newPolicy, setNewPolicy] = useState("");

  // Auto-populate from profile
  useEffect(() => {
    if (profile && !formData.companyName) {
      setFormData(prev => ({ ...prev, companyName: profile.company_name || "", companyAddress: profile.company_address || "" }));
    }
  }, [profile]);

  // --- File Upload ---
  const handleFileUpload = async (file: File) => {
    if (!user) return;
    setUploadedFile(file); setIsUploading(true); setIsExtracting(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const extractResponse = await fetch(`${BACKEND_URL}/api/extract-document`, { method: "POST", body: fd });
      if (!extractResponse.ok) throw new Error("Failed to extract text from document");
      const { extractedText } = await extractResponse.json();
      const uploadResult = await uploadFile(file, "company-documents", "", user.id);
      if (uploadResult.error) throw new Error(uploadResult.error);
      const extraction = await extractDocumentProfile(extractedText);
      setExtractionResult(extraction);
      setFormData(prev => ({
        ...prev, ...extraction.extractedProfile,
        services: [...(prev.services || []), ...(extraction.extractedProfile.services || [])].filter((v, i, a) => a.indexOf(v) === i),
        faqs: [...(prev.faqs || []), ...(extraction.extractedProfile.faqs || [])].filter((v, i, a) => a.indexOf(v) === i),
        objections: [...(prev.objections || []), ...(extraction.extractedProfile.objections || [])].filter((v, i, a) => a.indexOf(v) === i),
        policies: [...(prev.policies || []), ...(extraction.extractedProfile.policies || [])].filter((v, i, a) => a.indexOf(v) === i),
      }));
      toast({ title: "Document Processed", description: `Extracted data. ${extraction.missingFields.length} fields may need manual input.` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to process document", variant: "destructive" });
      setUploadedFile(null);
    } finally { setIsUploading(false); setIsExtracting(false); }
  };

  // --- Generate Prompt (calls OpenAI) ---
  const handleGeneratePrompt = async () => {
    if (!formData.companyName || !formData.agentPurpose || !formData.callType) {
      toast({ title: "Missing Required Fields", description: "Please fill in Company Name, Agent Purpose, and Call Type", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generatePromptFromProfile(formData);
      setGeneratedPrompt(result.finalPrompt || "");
      setGeneratedWelcomeMessages(result.welcomeMessages || []);
      toast({ title: "Success", description: "Prompt generated successfully via OpenAI" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to generate prompt", variant: "destructive" });
    } finally { setIsGenerating(false); }
  };

  // --- Format Prompt ---
  const handleFormatPrompt = async () => {
    if (!promptToFormat.trim()) { toast({ title: "Validation Error", description: "Please enter a prompt to format", variant: "destructive" }); return; }
    setIsFormatting(true);
    try {
      const formatted = await formatRawPrompt(promptToFormat);
      setFormattedPrompt(formatted);
      toast({ title: "Success", description: "Prompt formatted successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setIsFormatting(false); }
  };

  // --- List helpers ---
  const addItem = (field: "services" | "faqs" | "objections" | "policies", value: string, setter: (v: string) => void) => {
    if (value.trim()) { setFormData(prev => ({ ...prev, [field]: [...(prev[field] as string[] || []), value.trim()] })); setter(""); }
  };
  const removeItem = (field: "services" | "faqs" | "objections" | "policies", index: number) => {
    setFormData(prev => ({ ...prev, [field]: (prev[field] as string[] || []).filter((_, i) => i !== index) }));
  };
  const toggleCustomerField = (field: string) => {
    setFormData(prev => {
      const fields = prev.requiredCustomerFields || [];
      return { ...prev, requiredCustomerFields: fields.includes(field) ? fields.filter(f => f !== field) : [...fields, field] };
    });
  };

  // --- Clipboard ---
  const copyToClipboard = (text: string, type: string) => { navigator.clipboard.writeText(text); toast({ title: "Copied", description: `${type} copied to clipboard` }); };

  // --- Save ---
  const openSaveDialog = (content: string) => {
    setSavePromptContent(content);
    setSavePromptName(formData.companyName ? `${formData.companyName} - Prompt` : "New Prompt");
    setSaveDialogOpen(true);
  };

  const savePromptToAIPrompts = async () => {
    if (!user || !savePromptContent.trim() || !savePromptName.trim()) { toast({ title: "Validation Error", description: "Please provide a name and prompt content", variant: "destructive" }); return; }
    setSavingPrompt(true);
    try {
      const result = await createPrompt({
        name: savePromptName.trim(),
        category: savePromptCategory,
        system_prompt: savePromptContent,
        begin_message: null,
        agent_profile: formData as any,
        welcome_messages: generatedWelcomeMessages as any,
        call_type: formData.callType,
        call_goal: formData.callGoal,
        tone: formData.tone,
        status: "ready",
        state_prompts: {} as any,
        tools_config: {} as any,
        is_active: true,
        is_template: false,
      });
      if (result) { setSaveDialogOpen(false); setSavePromptName(""); setSavePromptContent(""); toast({ title: "Success", description: "Prompt saved! You can now use it in Agent Creation." }); }
    } catch (error: any) { toast({ title: "Error", description: error?.message || "Failed to save prompt", variant: "destructive" }); }
    finally { setSavingPrompt(false); }
  };

  // --- Edit / Delete ---
  const openEditDialog = (prompt: any) => { setEditingPrompt(prompt); setEditPromptName(prompt.name); setEditPromptCategory(prompt.category); setEditPromptContent(prompt.system_prompt); setEditBeginMessage(prompt.begin_message || ""); setIsActive(prompt.is_active ?? true); setEditDialogOpen(true); };
  const handleUpdatePrompt = async () => {
    if (!editingPrompt || !editPromptName.trim() || !editPromptContent.trim()) { toast({ title: "Validation Error", description: "Please provide a name and prompt content", variant: "destructive" }); return; }
    try {
      const success = await updatePrompt(editingPrompt.id, { name: editPromptName.trim(), category: editPromptCategory, system_prompt: editPromptContent, begin_message: editBeginMessage || null, is_active: isActive });
      if (success) { setEditDialogOpen(false); setEditingPrompt(null); toast({ title: "Success", description: "Prompt updated" }); }
    } catch (error: any) { toast({ title: "Error", description: error?.message || "Failed to update", variant: "destructive" }); }
  };
  const handleDeletePrompt = (id: string) => { setPromptToDelete(id); setDeleteDialogOpen(true); };
  const confirmDeletePrompt = async () => {
    if (!promptToDelete) return;
    try { const success = await deletePrompt(promptToDelete); if (success) { toast({ title: "Success", description: "Prompt deleted" }); setDeleteDialogOpen(false); setPromptToDelete(null); } }
    catch (error: any) { toast({ title: "Error", description: error?.message, variant: "destructive" }); }
  };

  const loadPromptToEditor = (prompt: any) => { setGeneratedPrompt(prompt.system_prompt); setActiveTab("generate"); toast({ title: "Loaded", description: "Prompt loaded into editor" }); };
  const togglePromptExpansion = (id: string) => { setExpandedPrompts(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; }); };

  const userPrompts = getUserPrompts();
  const customerFieldOptions = ["name", "phone", "email", "address", "company", "order_id", "account_number"];

  // --- RENDER ---
  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">AI Prompt Generator</h1>
          <p className="text-slate-500 text-base">Generate production-ready AI voice agent prompts. Saved prompts can be used to autofill agent creation.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="generate"><Sparkles className="mr-2 h-4 w-4" />Prompt Creator</TabsTrigger>
          <TabsTrigger value="format"><FileText className="mr-2 h-4 w-4" />Prompt Formatter</TabsTrigger>
          <TabsTrigger value="my-prompts"><List className="mr-2 h-4 w-4" />My Prompts</TabsTrigger>
        </TabsList>

        {/* ====== GENERATE TAB ====== */}
        <TabsContent value="generate" className="mt-6">
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Sparkles className="h-5 w-5 text-blue-600" />AI Prompt Generation
              </CardTitle>
              <CardDescription className="text-slate-500 mt-1">
                Fill in the essential fields below, then click Generate. Use "Advanced Prompt Setup" for extra customization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">

              {/* Document Upload */}
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2"><Upload className="h-4 w-4 text-blue-600" /><Label className="text-base font-semibold">Upload Company Document (Optional)</Label></div>
                <p className="text-sm text-slate-600">Upload a PDF, DOCX, or TXT file. The system will auto-extract and fill the form.</p>
                <div className="flex items-center gap-4">
                  <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} className="hidden" id="document-upload" disabled={isUploading || isExtracting} />
                  <label htmlFor="document-upload">
                    <Button type="button" variant="outline" disabled={isUploading || isExtracting} className="cursor-pointer">
                      {isUploading || isExtracting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isExtracting ? "Extracting..." : "Uploading..."}</>) : (<><Upload className="mr-2 h-4 w-4" />Upload Document</>)}
                    </Button>
                  </label>
                  {uploadedFile && (<div className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-green-600" /><span>{uploadedFile.name}</span><Button variant="ghost" size="sm" onClick={() => setUploadedFile(null)}><X className="h-4 w-4" /></Button></div>)}
                </div>
                {extractionResult && extractionResult.missingFields.length > 0 && (
                  <Alert><AlertCircle className="h-4 w-4" /><AlertDescription><strong>Missing Fields:</strong> {extractionResult.missingFields.join(", ")}. Please fill these manually.</AlertDescription></Alert>
                )}
              </div>

              {/* ===== ESSENTIAL FIELDS ===== */}
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center gap-2"><Building2 className="h-4 w-4" /><Label className="text-base font-semibold">Essential Information</Label></div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name <span className="text-destructive">*</span></Label>
                    <Input id="companyName" value={formData.companyName || ""} onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))} placeholder="e.g., NSOL BPO" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessIndustry">Business Industry</Label>
                    <Input id="businessIndustry" value={formData.businessIndustry || ""} onChange={(e) => setFormData(prev => ({ ...prev, businessIndustry: e.target.value }))} placeholder="e.g., BPO, Healthcare, Real Estate" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="callType">Call Type <span className="text-destructive">*</span></Label>
                    <Select value={formData.callType} onValueChange={(value: AgentPromptProfile["callType"]) => setFormData(prev => ({ ...prev, callType: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sales">Sales</SelectItem><SelectItem value="Support">Support</SelectItem>
                        <SelectItem value="Booking">Booking</SelectItem><SelectItem value="Billing">Billing</SelectItem>
                        <SelectItem value="Complaint">Complaint</SelectItem><SelectItem value="Mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="callGoal">Call Goal</Label>
                    <Select value={formData.callGoal} onValueChange={(value: AgentPromptProfile["callGoal"]) => setFormData(prev => ({ ...prev, callGoal: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Book Appointment">Book Appointment</SelectItem><SelectItem value="Close Sale">Close Sale</SelectItem>
                        <SelectItem value="Qualify Lead">Qualify Lead</SelectItem><SelectItem value="Collect Information">Collect Information</SelectItem>
                        <SelectItem value="Support Resolution">Support Resolution</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="agentPurpose">Agent Purpose <span className="text-destructive">*</span></Label>
                    <Textarea id="agentPurpose" value={formData.agentPurpose || ""} onChange={(e) => setFormData(prev => ({ ...prev, agentPurpose: e.target.value }))} placeholder="e.g., Handle inbound customer support calls and book appointments" className="min-h-[80px]" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="targetAudience">Target Audience</Label>
                    <Input id="targetAudience" value={formData.targetAudience || ""} onChange={(e) => setFormData(prev => ({ ...prev, targetAudience: e.target.value }))} placeholder="e.g., Small business owners looking for IT services" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tone">Tone</Label>
                    <Select value={formData.tone} onValueChange={(value: AgentPromptProfile["tone"]) => setFormData(prev => ({ ...prev, tone: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Friendly">Friendly</SelectItem><SelectItem value="Professional">Professional</SelectItem>
                        <SelectItem value="Empathetic">Empathetic</SelectItem><SelectItem value="Energetic">Energetic</SelectItem>
                        <SelectItem value="Strict">Strict</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Services - essential */}
                <div className="space-y-2 mt-4">
                  <Label>Services (add at least 1)</Label>
                  <div className="flex gap-2">
                    <Input value={newService} onChange={(e) => setNewService(e.target.value)} onKeyPress={(e) => e.key === "Enter" && addItem("services", newService, setNewService)} placeholder="Add a service" />
                    <Button type="button" onClick={() => addItem("services", newService, setNewService)}>Add</Button>
                  </div>
                  {formData.services && formData.services.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.services.map((s, i) => (<div key={i} className="flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-full"><span className="text-sm">{s}</span><Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeItem("services", i)}><X className="h-3 w-3" /></Button></div>))}
                    </div>
                  )}
                </div>
              </div>

              {/* ===== ADVANCED PROMPT SETUP TOGGLE ===== */}
              <Button type="button" variant="outline" className="w-full border-dashed border-2 border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 transition-all" onClick={() => setShowAdvanced(!showAdvanced)}>
                <Settings2 className="mr-2 h-4 w-4" />
                {showAdvanced ? "Hide" : "Show"} Advanced Prompt Setup
                {showAdvanced ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
              </Button>

              {/* ===== ADVANCED FIELDS (hidden by default) ===== */}
              {showAdvanced && (
                <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                  {/* Company Details */}
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <Label className="text-base font-semibold">Company Details</Label>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Company Address</Label><Input value={formData.companyAddress || ""} onChange={(e) => setFormData(prev => ({ ...prev, companyAddress: e.target.value }))} placeholder="e.g., 123 Main St, NY" /></div>
                      <div className="space-y-2"><Label>Website</Label><Input value={formData.companyWebsite || ""} onChange={(e) => setFormData(prev => ({ ...prev, companyWebsite: e.target.value }))} placeholder="https://example.com" /></div>
                      <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.companyEmail || ""} onChange={(e) => setFormData(prev => ({ ...prev, companyEmail: e.target.value }))} placeholder="contact@example.com" /></div>
                      <div className="space-y-2"><Label>Phone</Label><Input value={formData.companyPhone || ""} onChange={(e) => setFormData(prev => ({ ...prev, companyPhone: e.target.value }))} placeholder="+1 234 567 8900" /></div>
                      <div className="space-y-2 md:col-span-2"><Label>Business Description</Label><Textarea value={formData.businessDescription || ""} onChange={(e) => setFormData(prev => ({ ...prev, businessDescription: e.target.value }))} placeholder="Short summary of your business" className="min-h-[80px]" /></div>
                    </div>
                  </div>

                  {/* Operational Info */}
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <Label className="text-base font-semibold">Operational Information</Label>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Pricing Info</Label><Textarea value={formData.pricingInfo || ""} onChange={(e) => setFormData(prev => ({ ...prev, pricingInfo: e.target.value }))} placeholder="Pricing details" className="min-h-[80px]" /></div>
                      <div className="space-y-2"><Label>Business Hours</Label><Input value={formData.businessHours || ""} onChange={(e) => setFormData(prev => ({ ...prev, businessHours: e.target.value }))} placeholder="e.g., Mon-Fri 9AM-5PM" /></div>
                      <div className="space-y-2"><Label>Booking Method</Label><Input value={formData.bookingMethod || ""} onChange={(e) => setFormData(prev => ({ ...prev, bookingMethod: e.target.value }))} placeholder="e.g., Calendar link or manual" /></div>
                      <div className="space-y-2"><Label>Appointment Rules</Label><Textarea value={formData.appointmentRules || ""} onChange={(e) => setFormData(prev => ({ ...prev, appointmentRules: e.target.value }))} placeholder="How booking works" className="min-h-[80px]" /></div>
                      <div className="space-y-2 md:col-span-2"><Label>Escalation Process</Label><Textarea value={formData.escalationProcess || ""} onChange={(e) => setFormData(prev => ({ ...prev, escalationProcess: e.target.value }))} placeholder="What to do if issue cannot be resolved" className="min-h-[80px]" /></div>
                    </div>
                  </div>

                  {/* Required Customer Fields */}
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <Label className="text-base font-semibold">Required Customer Fields</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {customerFieldOptions.map((field) => (
                        <div key={field} className="flex items-center space-x-2">
                          <Checkbox id={field} checked={formData.requiredCustomerFields?.includes(field)} onCheckedChange={() => toggleCustomerField(field)} />
                          <Label htmlFor={field} className="text-sm font-normal cursor-pointer capitalize">{field.replace("_", " ")}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* FAQs */}
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <Label className="text-base font-semibold">FAQs</Label>
                    <div className="flex gap-2"><Input value={newFaq} onChange={(e) => setNewFaq(e.target.value)} onKeyPress={(e) => e.key === "Enter" && addItem("faqs", newFaq, setNewFaq)} placeholder="Add a FAQ" /><Button type="button" onClick={() => addItem("faqs", newFaq, setNewFaq)}>Add</Button></div>
                    {formData.faqs && formData.faqs.length > 0 && (<div className="space-y-2">{formData.faqs.map((faq, i) => (<div key={i} className="flex items-center gap-2 bg-slate-100 p-2 rounded"><span className="text-sm flex-1">{faq}</span><Button type="button" variant="ghost" size="sm" onClick={() => removeItem("faqs", i)}><X className="h-4 w-4" /></Button></div>))}</div>)}
                  </div>

                  {/* Objections */}
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <Label className="text-base font-semibold">Objections & Responses</Label>
                    <div className="flex gap-2"><Input value={newObjection} onChange={(e) => setNewObjection(e.target.value)} onKeyPress={(e) => e.key === "Enter" && addItem("objections", newObjection, setNewObjection)} placeholder="Add objection + response" /><Button type="button" onClick={() => addItem("objections", newObjection, setNewObjection)}>Add</Button></div>
                    {formData.objections && formData.objections.length > 0 && (<div className="space-y-2">{formData.objections.map((o, i) => (<div key={i} className="flex items-center gap-2 bg-slate-100 p-2 rounded"><span className="text-sm flex-1">{o}</span><Button type="button" variant="ghost" size="sm" onClick={() => removeItem("objections", i)}><X className="h-4 w-4" /></Button></div>))}</div>)}
                  </div>

                  {/* Policies */}
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <Label className="text-base font-semibold">Policies</Label>
                    <div className="flex gap-2"><Input value={newPolicy} onChange={(e) => setNewPolicy(e.target.value)} onKeyPress={(e) => e.key === "Enter" && addItem("policies", newPolicy, setNewPolicy)} placeholder="Add policy (refund, cancellation, etc.)" /><Button type="button" onClick={() => addItem("policies", newPolicy, setNewPolicy)}>Add</Button></div>
                    {formData.policies && formData.policies.length > 0 && (<div className="space-y-2">{formData.policies.map((p, i) => (<div key={i} className="flex items-center gap-2 bg-slate-100 p-2 rounded"><span className="text-sm flex-1">{p}</span><Button type="button" variant="ghost" size="sm" onClick={() => removeItem("policies", i)}><X className="h-4 w-4" /></Button></div>))}</div>)}
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <Button onClick={handleGeneratePrompt} disabled={isGenerating} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white" size="lg">
                {isGenerating ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating via OpenAI...</>) : (<><Sparkles className="mr-2 h-4 w-4" />Generate Prompt</>)}
              </Button>


              {/* Generated Prompt Output */}
              {generatedPrompt && (<>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-base font-semibold">Generated Prompt</Label>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openSaveDialog(generatedPrompt)}><Save className="mr-2 h-4 w-4" />Save</Button>
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(generatedPrompt, "Prompt")}><Copy className="mr-2 h-4 w-4" />Copy</Button>
                    </div>
                  </div>
                  <Textarea value={generatedPrompt} onChange={(e) => setGeneratedPrompt(e.target.value)} className="min-h-[400px] font-mono text-sm" />
                </div>
                {generatedWelcomeMessages.length > 0 && (
                  <div className="space-y-2 p-4 bg-green-50 rounded-lg border border-green-200">
                    <Label className="text-base font-semibold text-green-800">Generated Welcome Messages</Label>
                    <div className="space-y-2">{generatedWelcomeMessages.map((msg, i) => (<div key={i} className="flex items-center gap-2 text-sm bg-white p-2 rounded border"><span className="text-green-700 font-medium">{i + 1}.</span><span>{msg}</span><Button variant="ghost" size="sm" onClick={() => copyToClipboard(msg, "Welcome message")}><Copy className="h-3 w-3" /></Button></div>))}</div>
                  </div>
                )}
              </>)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== FORMAT TAB ====== */}
        <TabsContent value="format" className="mt-6">
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900"><FileText className="h-5 w-5 text-blue-600" />Prompt Formatter</CardTitle>
              <CardDescription className="text-slate-500 mt-1">Convert your raw unstructured prompt into a clear, structured, professional AI prompt</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="prompt_to_format">Raw Prompt to Format <span className="text-destructive">*</span></Label>
                <Textarea id="prompt_to_format" placeholder='e.g., "make me a prompt for calling leads and selling my service"' value={promptToFormat} onChange={(e) => setPromptToFormat(e.target.value)} className="min-h-[200px]" />
              </div>
              <Button onClick={handleFormatPrompt} disabled={isFormatting || !promptToFormat.trim()} className="w-full" size="lg">
                {isFormatting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Formatting...</>) : (<><FileText className="mr-2 h-4 w-4" />Format Prompt</>)}
              </Button>
              {formattedPrompt && (<><Separator /><div className="space-y-2"><div className="flex items-center justify-between gap-2"><Label>Formatted Prompt</Label><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => openSaveDialog(formattedPrompt)}><Save className="mr-2 h-4 w-4" />Save</Button><Button variant="outline" size="sm" onClick={() => copyToClipboard(formattedPrompt, "Formatted prompt")}><Copy className="mr-2 h-4 w-4" />Copy</Button></div></div><Textarea value={formattedPrompt} onChange={(e) => setFormattedPrompt(e.target.value)} className="min-h-[400px] font-mono text-sm" /></div></>)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== MY PROMPTS TAB ====== */}
        <TabsContent value="my-prompts" className="mt-6">
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900"><List className="h-5 w-5 text-blue-600" />My Prompts</CardTitle>
              <CardDescription className="text-slate-500 mt-1">View, manage, and reuse your saved prompts. These can be selected during agent creation to autofill forms.</CardDescription>
            </CardHeader>
            <CardContent>
              {promptsLoading ? (<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : userPrompts.length === 0 ? (<div className="text-center py-12 text-muted-foreground"><List className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No prompts saved yet</p><p className="text-sm mt-2">Generate or format a prompt to save it here</p></div>
              ) : (
                <div className="space-y-4">
                  {userPrompts.map((prompt) => {
                    const isExpanded = expandedPrompts.has(prompt.id);
                    const promptPreview = prompt.system_prompt?.substring(0, 150) || "";
                    return (
                      <Card key={prompt.id} className="border-border/50 hover:border-primary/50 transition-colors">
                        <CardHeader className="pb-3 cursor-pointer" onClick={() => togglePromptExpansion(prompt.id)}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                                <CardTitle className="text-lg flex items-center gap-2">{prompt.name}
                                  <span className={`text-xs px-2 py-1 rounded-full ${prompt.is_active ? "bg-green-500/20 text-green-600" : "bg-gray-500/20 text-gray-600"}`}>{prompt.is_active ? "Active" : "Inactive"}</span>
                                  {(prompt as any).status === "ready" && <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-600">Agent Ready</span>}
                                </CardTitle>
                              </div>
                              <CardDescription className="mt-1 flex items-center gap-4 flex-wrap">
                                <span>Category: {prompt.category}</span><span>•</span><span>Usage: {prompt.usage_count || 0}</span><span>•</span><span>{new Date(prompt.created_at).toLocaleDateString()}</span>
                              </CardDescription>
                              {!isExpanded && promptPreview && (<div className="mt-2"><p className="text-sm text-muted-foreground line-clamp-2 font-mono">{promptPreview}...</p></div>)}
                            </div>
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button variant="outline" size="sm" onClick={() => loadPromptToEditor(prompt)} title="Load into editor"><FileText className="h-4 w-4" /></Button>
                              <Button variant="outline" size="sm" onClick={() => openEditDialog(prompt)} title="Edit"><Edit2 className="h-4 w-4" /></Button>
                              <Button variant="outline" size="sm" onClick={() => handleDeletePrompt(prompt.id)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </div>
                        </CardHeader>
                        {isExpanded && (
                          <CardContent className="space-y-4 pt-0">
                            <div><Label className="text-sm font-semibold mb-2 block">System Prompt:</Label><div className="p-4 bg-muted/30 rounded-lg border border-border/50 max-h-96 overflow-y-auto"><pre className="text-sm whitespace-pre-wrap font-mono">{prompt.system_prompt}</pre></div></div>
                            {prompt.begin_message && (<div><Label className="text-sm font-semibold mb-2 block">Begin Message:</Label><div className="p-3 bg-muted/30 rounded-lg border border-border/50"><p className="text-sm">{prompt.begin_message}</p></div></div>)}
                            <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => copyToClipboard(prompt.system_prompt || "", "Prompt")} className="flex-1"><Copy className="mr-2 h-4 w-4" />Copy Prompt</Button></div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Save Prompt</DialogTitle><DialogDescription>Save your prompt for later use and agent creation autofill</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={savePromptName} onChange={(e) => setSavePromptName(e.target.value)} placeholder="e.g., Sales Agent Prompt" /></div>
            <div className="space-y-2"><Label>Category</Label>
              <Select value={savePromptCategory} onValueChange={setSavePromptCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="general">General</SelectItem><SelectItem value="sales">Sales</SelectItem><SelectItem value="support">Support</SelectItem><SelectItem value="appointment">Appointment</SelectItem><SelectItem value="follow-up">Follow-up</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Preview</Label><div className="p-3 bg-muted/30 rounded-lg border border-border/50 max-h-40 overflow-y-auto"><pre className="text-sm whitespace-pre-wrap font-mono">{savePromptContent.substring(0, 500)}{savePromptContent.length > 500 && "..."}</pre></div></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={savingPrompt}>Cancel</Button>
              <Button onClick={savePromptToAIPrompts} disabled={!savePromptName.trim() || savingPrompt}>{savingPrompt ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : (<><Save className="mr-2 h-4 w-4" />Save</>)}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Prompt</DialogTitle><DialogDescription>Update your prompt details</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={editPromptName} onChange={(e) => setEditPromptName(e.target.value)} placeholder="Enter prompt name" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Category</Label><Select value={editPromptCategory} onValueChange={setEditPromptCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="general">General</SelectItem><SelectItem value="sales">Sales</SelectItem><SelectItem value="support">Support</SelectItem><SelectItem value="appointment">Appointment</SelectItem><SelectItem value="follow-up">Follow-up</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Status</Label><Select value={isActive ? "active" : "inactive"} onValueChange={(v) => setIsActive(v === "active")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>System Prompt</Label><Textarea value={editPromptContent} onChange={(e) => setEditPromptContent(e.target.value)} className="min-h-[300px] font-mono text-sm" placeholder="Enter system prompt" /></div>
            <div className="space-y-2"><Label>Begin Message (Optional)</Label><Textarea value={editBeginMessage} onChange={(e) => setEditBeginMessage(e.target.value)} className="min-h-[80px]" placeholder="Enter begin message" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setEditDialogOpen(false); setEditingPrompt(null); }}>Cancel</Button>
              <Button onClick={handleUpdatePrompt} disabled={!editPromptName.trim() || !editPromptContent.trim()}><Save className="mr-2 h-4 w-4" />Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Prompt</DialogTitle><DialogDescription>Are you sure you want to delete this prompt? This action cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setPromptToDelete(null); }}>Cancel</Button><Button variant="destructive" onClick={confirmDeletePrompt}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
