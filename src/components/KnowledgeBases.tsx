import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, FileText, Upload, X, Search, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  faq_count?: number;
  document_count?: number;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  priority: number;
  display_order: number;
}

interface Document {
  id: string;
  name: string;
  file_type: string | null;
  file_url: string;
  file_size: number | null;
  description: string | null;
  storage_path: string | null;
  uploaded_at: string;
}

const KnowledgeBases: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showFAQDialog, setShowFAQDialog] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', category: '', priority: 0 });
  const [kbForm, setKbForm] = useState({ name: '', description: '' });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      loadKnowledgeBases();
    }
  }, [user]);

  const loadKnowledgeBases = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('knowledge_bases')
        .select(`
          *,
          faqs:knowledge_base_faqs(count),
          documents:knowledge_base_documents(count)
        `)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const kbWithCounts = (data || []).map((kb: any) => ({
        ...kb,
        faq_count: kb.faqs?.[0]?.count || 0,
        document_count: kb.documents?.[0]?.count || 0,
      }));

      setKnowledgeBases(kbWithCounts);
    } catch (err: any) {
      console.error('Error loading knowledge bases:', err);
      setError(err.message || 'Failed to load knowledge bases');
      setKnowledgeBases([]);
    } finally {
      setLoading(false);
    }
  };

  const loadKBDetails = async (kbId: string) => {
    try {
      // Load FAQs
      const { data: faqsData, error: faqsError } = await supabase
        .from('knowledge_base_faqs')
        .select('*')
        .eq('knowledge_base_id', kbId)
        .is('deleted_at', null)
        .order('priority', { ascending: false })
        .order('display_order', { ascending: true });

      if (faqsError) throw faqsError;
      setFaqs(faqsData || []);

      // Load Documents
      const { data: docsData, error: docsError } = await supabase
        .from('knowledge_base_documents')
        .select('*')
        .eq('knowledge_base_id', kbId)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false });

      if (docsError) throw docsError;
      setDocuments(docsData || []);
    } catch (err: any) {
      console.error('Error loading KB details:', err);
      alert('Failed to load knowledge base details');
    }
  };

  const handleCreateKB = async () => {
    if (!kbForm.name.trim()) {
      alert('Please enter a name for the knowledge base');
      return;
    }

    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('knowledge_bases')
        .insert({
          user_id: user.id,
          name: kbForm.name,
          description: kbForm.description || null,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      setShowCreateDialog(false);
      setKbForm({ name: '', description: '' });
      loadKnowledgeBases();
    } catch (err: any) {
      console.error('Error creating knowledge base:', err);
      alert('Failed to create knowledge base');
    }
  };

  const handleManageKB = (kb: KnowledgeBase) => {
    setSelectedKB(kb);
    setShowManageDialog(true);
    loadKBDetails(kb.id);
  };

  const handleDeleteKB = async (kbId: string, kbName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${kbName}"? This will also delete all FAQs and documents.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('knowledge_bases')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', kbId)
        .eq('user_id', user?.id);

      if (error) throw error;

      loadKnowledgeBases();
    } catch (err: any) {
      console.error('Error deleting knowledge base:', err);
      alert('Failed to delete knowledge base');
    }
  };

  const handleSaveFAQ = async () => {
    if (!faqForm.question.trim() || !faqForm.answer.trim() || !selectedKB) {
      alert('Please fill in both question and answer');
      return;
    }

    try {
      if (editingFAQ) {
        const { error } = await supabase
          .from('knowledge_base_faqs')
          .update({
            question: faqForm.question,
            answer: faqForm.answer,
            category: faqForm.category || null,
            priority: faqForm.priority,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingFAQ.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('knowledge_base_faqs')
          .insert({
            knowledge_base_id: selectedKB.id,
            question: faqForm.question,
            answer: faqForm.answer,
            category: faqForm.category || null,
            priority: faqForm.priority,
          });

        if (error) throw error;
      }

      setShowFAQDialog(false);
      setFaqForm({ question: '', answer: '', category: '', priority: 0 });
      setEditingFAQ(null);
      loadKBDetails(selectedKB.id);
      loadKnowledgeBases(); // Refresh counts
    } catch (err: any) {
      console.error('Error saving FAQ:', err);
      alert('Failed to save FAQ');
    }
  };

  const handleDeleteFAQ = async (faqId: string) => {
    if (!window.confirm('Are you sure you want to delete this FAQ?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('knowledge_base_faqs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', faqId);

      if (error) throw error;

      if (selectedKB) {
        loadKBDetails(selectedKB.id);
        loadKnowledgeBases();
      }
    } catch (err: any) {
      console.error('Error deleting FAQ:', err);
      alert('Failed to delete FAQ');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedKB) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      // Simplified path: just use KB ID as folder, no nested knowledge-bases prefix
      const filePath = `${selectedKB.id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('agent-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        // Provide more helpful error messages
        if (uploadError.message.includes('Bucket not found')) {
          throw new Error('Storage bucket "agent-documents" not found. Please create it in Supabase Storage dashboard.');
        }
        if (uploadError.message.includes('row-level security') || uploadError.message.includes('RLS')) {
          throw new Error('Access denied. Please ensure the "agent-documents" bucket has proper RLS policies configured to allow authenticated users to upload files.');
        }
        if (uploadError.message.includes('new row violates')) {
          throw new Error('Storage access denied. Please check RLS policies for the "agent-documents" bucket.');
        }
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('agent-documents')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from('knowledge_base_documents')
        .insert({
          knowledge_base_id: selectedKB.id,
          name: file.name,
          file_type: file.type || 'application/octet-stream',
          file_url: urlData.publicUrl,
          file_size: file.size,
          storage_path: filePath,
        });

      if (insertError) throw insertError;

      loadKBDetails(selectedKB.id);
      loadKnowledgeBases();
      
      // Reset file input
      e.target.value = '';
    } catch (err: any) {
      console.error('Error uploading file:', err);
      const errorMessage = err.message || 'Failed to upload document. Please check that the storage bucket exists and has proper permissions.';
      alert(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string, storagePath: string | null) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      if (storagePath) {
        await supabase.storage
          .from('agent-documents')
          .remove([storagePath]);
      }

      const { error } = await supabase
        .from('knowledge_base_documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', docId);

      if (error) throw error;

      if (selectedKB) {
        loadKBDetails(selectedKB.id);
        loadKnowledgeBases();
      }
    } catch (err: any) {
      console.error('Error deleting document:', err);
      alert('Failed to delete document');
    }
  };

  const filteredBases = knowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (kb.description && kb.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6" style={{ fontFamily: "'Manrope', sans-serif" }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Knowledge Bases</h1>
            <p className="text-[18px] dark:text-[#818898] text-[#737373] mt-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Create and manage reusable knowledge bases for your agents
            </p>
          </div>
          <Button 
            onClick={() => setShowCreateDialog(true)}
            className="text-[16px] font-medium"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Knowledge Base
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 dark:text-[#818898] text-[#737373]" />
          <Input
            placeholder="Search knowledge bases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background dark:text-[#f9fafb] text-[#27272b] dark:border-[#2f3541] border-[#e5e5e5] text-[16px]"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          />
        </div>

        {/* Knowledge Bases List */}
        {filteredBases.length === 0 ? (
          <Card className="rounded-[14px]">
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4 text-center" style={{ fontFamily: "'Manrope', sans-serif" }}>
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <BookOpen className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-[24px] font-bold dark:text-[#f9fafb] text-[#27272b] mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>No Knowledge Bases</h3>
                  <p className="text-[16px] dark:text-[#818898] text-[#737373] max-w-md" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    Create your first knowledge base to store FAQs and documents for your agents.
                  </p>
                </div>
                <Button 
                  onClick={() => setShowCreateDialog(true)}
                  className="text-[16px] font-medium"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Your First Knowledge Base
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="dark:bg-[#1d212b] dark:border-[#2f3541] rounded-[14px]">
            <CardHeader className="px-5 pt-5 pb-0">
              <CardTitle className="text-[18px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Your Knowledge Bases ({filteredBases.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-5">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Name</TableHead>
                      <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Description</TableHead>
                      <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>FAQs</TableHead>
                      <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Documents</TableHead>
                      <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Status</TableHead>
                      <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Created</TableHead>
                      <TableHead className="text-right text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBases.map((kb) => (
                      <TableRow key={kb.id}>
                        <TableCell className="text-[16px] font-medium text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          {kb.name}
                        </TableCell>
                        <TableCell className="text-[16px] dark:text-[#818898] text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          {kb.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[14px]" style={{ fontFamily: "'Manrope', sans-serif" }}>{kb.faq_count || 0} FAQs</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[14px]" style={{ fontFamily: "'Manrope', sans-serif" }}>{kb.document_count || 0} Docs</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={kb.status === 'active' ? 'success' : 'default'} className="text-[14px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                            {kb.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[16px] dark:text-[#818898] text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          {new Date(kb.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleManageKB(kb)}
                              title="Manage Knowledge Base"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteKB(kb.id, kb.name)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Delete Knowledge Base"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Knowledge Base Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Knowledge Base</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create a new knowledge base to store FAQs and documents
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="kb-name" className="text-foreground">Name *</Label>
              <Input
                id="kb-name"
                value={kbForm.name}
                onChange={(e) => setKbForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Product Support KB"
                className="bg-background text-foreground border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-description" className="text-foreground">Description</Label>
              <Textarea
                id="kb-description"
                value={kbForm.description}
                onChange={(e) => setKbForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this knowledge base is for..."
                rows={3}
                className="bg-background text-foreground border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateKB}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Knowledge Base Dialog */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent className="bg-card text-foreground border-border max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Manage: {selectedKB?.name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add FAQs and upload documents for this knowledge base
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* FAQs Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>FAQs ({faqs.length})</h3>
                <Button onClick={() => {
                  setEditingFAQ(null);
                  setFaqForm({ question: '', answer: '', category: '', priority: 0 });
                  setShowFAQDialog(true);
                }} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add FAQ
                </Button>
              </div>

              {faqs.length === 0 ? (
                <Alert>
                  <AlertDescription>No FAQs added yet. Click "Add FAQ" to create your first FAQ.</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {faqs.map((faq) => (
                    <Card key={faq.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            {faq.category && (
                              <Badge variant="outline">{faq.category}</Badge>
                            )}
                            <h4 className="font-semibold text-foreground">{faq.question}</h4>
                            <p className="text-sm text-muted-foreground">{faq.answer}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingFAQ(faq);
                                setFaqForm({
                                  question: faq.question,
                                  answer: faq.answer,
                                  category: faq.category || '',
                                  priority: faq.priority,
                                });
                                setShowFAQDialog(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteFAQ(faq.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Documents Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Documents ({documents.length})</h3>
                <div className="relative">
                  <input
                    type="file"
                    id="document-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".pdf,.txt,.doc,.docx"
                  />
                  <Button
                    asChild
                    size="sm"
                    disabled={uploading}
                  >
                    <label htmlFor="document-upload" className="cursor-pointer">
                      {uploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Document
                        </>
                      )}
                    </label>
                  </Button>
                </div>
              </div>

              {documents.length === 0 ? (
                <Alert>
                  <AlertDescription>No documents uploaded yet. Upload PDFs, text files, or documents.</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.uploaded_at).toLocaleDateString()} • {doc.file_size ? `${(doc.file_size / 1024).toFixed(2)} KB` : 'Unknown size'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(doc.file_url, '_blank')}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDocument(doc.id, doc.storage_path || null)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowManageDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FAQ Dialog */}
      <Dialog open={showFAQDialog} onOpenChange={setShowFAQDialog}>
        <DialogContent className="bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingFAQ ? 'Edit FAQ' : 'Add FAQ'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a question and answer pair for this knowledge base
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="faq-category" className="text-foreground">Category (Optional)</Label>
              <Input
                id="faq-category"
                value={faqForm.category}
                onChange={(e) => setFaqForm(prev => ({ ...prev, category: e.target.value }))}
                placeholder="e.g., Pricing, Support, Product"
                className="bg-background text-foreground border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faq-question" className="text-foreground">Question *</Label>
              <Input
                id="faq-question"
                value={faqForm.question}
                onChange={(e) => setFaqForm(prev => ({ ...prev, question: e.target.value }))}
                placeholder="What is your return policy?"
                className="bg-background text-foreground border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faq-answer" className="text-foreground">Answer *</Label>
              <Textarea
                id="faq-answer"
                value={faqForm.answer}
                onChange={(e) => setFaqForm(prev => ({ ...prev, answer: e.target.value }))}
                placeholder="We offer a 30-day return policy..."
                rows={4}
                className="bg-background text-foreground border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faq-priority" className="text-foreground">Priority (0-10)</Label>
              <Input
                id="faq-priority"
                type="number"
                min="0"
                max="10"
                value={faqForm.priority}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  const clampedVal = Math.max(0, Math.min(10, val));
                  setFaqForm(prev => ({ ...prev, priority: clampedVal }));
                }}
                placeholder="0"
                className="bg-background text-foreground border-border"
              />
              <p className="text-xs text-muted-foreground">Priority from 0 (lowest) to 10 (highest). Higher priority FAQs appear first.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFAQDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFAQ}>
              {editingFAQ ? 'Update FAQ' : 'Add FAQ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default KnowledgeBases;
