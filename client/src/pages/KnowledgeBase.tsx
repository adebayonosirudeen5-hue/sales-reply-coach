import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Brain,
  FileText,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Link as LinkIcon,
  ChevronDown,
  Lightbulb,
  MessageCircle,
  Sparkles,
  Heart,
  Briefcase,
  Globe,
  Youtube,
  Instagram
} from "lucide-react";

export default function KnowledgeBase() {
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [urlTitle, setUrlTitle] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [pdfTitle, setPdfTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.knowledgeBase.list.useQuery();

  const addUrl = trpc.knowledgeBase.addUrl.useMutation({
    onSuccess: (data) => {
      toast.success(`URL added to knowledge base! (${data.platform})`);
      setUrlDialogOpen(false);
      setUrlTitle("");
      setUrlValue("");
      utils.knowledgeBase.list.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to add URL: " + error.message);
    },
  });

  const addPdf = trpc.knowledgeBase.addPdf.useMutation({
    onSuccess: () => {
      toast.success("PDF uploaded to knowledge base!");
      setPdfDialogOpen(false);
      setPdfTitle("");
      setSelectedFile(null);
      utils.knowledgeBase.list.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to upload PDF: " + error.message);
    },
  });

  const processItem = trpc.knowledgeBase.processItem.useMutation({
    onSuccess: () => {
      toast.success("Content processed successfully!");
      utils.knowledgeBase.list.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to process: " + error.message);
      utils.knowledgeBase.list.invalidate();
    },
  });

  const setBrainType = trpc.knowledgeBase.setBrainType.useMutation({
    onSuccess: () => {
      toast.success("Brain type updated!");
      utils.knowledgeBase.list.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to update: " + error.message);
    },
  });

  const deleteItem = trpc.knowledgeBase.delete.useMutation({
    onSuccess: () => {
      toast.success("Item removed from knowledge base");
      utils.knowledgeBase.list.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  const handleAddUrl = () => {
    if (!urlTitle.trim() || !urlValue.trim()) {
      toast.error("Please enter both title and URL");
      return;
    }
    addUrl.mutate({ title: urlTitle.trim(), url: urlValue.trim() });
  };

  const handleAddPdf = async () => {
    if (!pdfTitle.trim() || !selectedFile) {
      toast.error("Please enter a title and select a file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      addPdf.mutate({
        title: pdfTitle.trim(),
        fileBase64: base64,
        fileName: selectedFile.name,
      });
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Please select a PDF file");
        return;
      }
      setSelectedFile(file);
    }
  };

  const toggleExpanded = (id: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
      pending: {
        icon: <Clock className="h-3 w-3" />,
        className: "bg-yellow-100 text-yellow-800 border-yellow-200",
        label: "Pending",
      },
      processing: {
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        className: "bg-blue-100 text-blue-800 border-blue-200",
        label: "Processing",
      },
      ready: {
        icon: <CheckCircle2 className="h-3 w-3" />,
        className: "bg-green-100 text-green-800 border-green-200",
        label: "Ready",
      },
      failed: {
        icon: <AlertCircle className="h-3 w-3" />,
        className: "bg-red-100 text-red-800 border-red-200",
        label: "Failed",
      },
    };
    const { icon, className, label } = config[status] || config.pending;
    return (
      <Badge variant="outline" className={`gap-1 ${className}`}>
        {icon}
        {label}
      </Badge>
    );
  };

  const getBrainTypeBadge = (brainType: string | null) => {
    const type = brainType || "both";
    const config: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
      friend: {
        icon: <Heart className="h-3 w-3" />,
        className: "bg-pink-100 text-pink-800 border-pink-200",
        label: "Friend Brain",
      },
      expert: {
        icon: <Briefcase className="h-3 w-3" />,
        className: "bg-blue-100 text-blue-800 border-blue-200",
        label: "Expert Brain",
      },
      both: {
        icon: <Brain className="h-3 w-3" />,
        className: "bg-purple-100 text-purple-800 border-purple-200",
        label: "Both",
      },
    };
    const { icon, className, label } = config[type] || config.both;
    return (
      <Badge variant="outline" className={`gap-1 ${className}`}>
        {icon}
        {label}
      </Badge>
    );
  };

  const getPlatformIcon = (platform: string | null, type: string) => {
    if (type === "pdf") return <FileText className="h-5 w-5 text-red-500" />;
    
    switch (platform) {
      case "youtube":
        return <Youtube className="h-5 w-5 text-red-500" />;
      case "instagram":
        return <Instagram className="h-5 w-5 text-pink-500" />;
      default:
        return <Globe className="h-5 w-5 text-primary" />;
    }
  };

  const getPlatformLabel = (platform: string | null, type: string) => {
    if (type === "pdf") return "PDF";
    if (type === "video") return "VIDEO";
    return platform?.toUpperCase() || "URL";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Knowledge Base
          </h1>
          <p className="text-muted-foreground">
            Train your AI coach with URLs and documents
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <LinkIcon className="h-4 w-4" />
                Add URL
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add URL</DialogTitle>
                <DialogDescription>
                  Add a YouTube, Instagram, or any other URL to your knowledge base.
                  The AI will extract and learn from the content.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="url-title">Title</Label>
                  <Input
                    id="url-title"
                    placeholder="e.g., Objection Handling Masterclass"
                    value={urlTitle}
                    onChange={(e) => setUrlTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url-value">URL</Label>
                  <Input
                    id="url-value"
                    placeholder="https://youtube.com/watch?v=... or https://instagram.com/p/..."
                    value={urlValue}
                    onChange={(e) => setUrlValue(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports YouTube, Instagram, TikTok, Facebook, Twitter/X, LinkedIn, and more
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleAddUrl}
                  disabled={addUrl.isPending}
                  className="gap-2"
                >
                  {addUrl.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add URL
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <FileText className="h-4 w-4" />
                Upload PDF
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload PDF Document</DialogTitle>
                <DialogDescription>
                  Upload sales scripts, methodologies, or training materials
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="pdf-title">Title</Label>
                  <Input
                    id="pdf-title"
                    placeholder="e.g., Sales Script Template"
                    value={pdfTitle}
                    onChange={(e) => setPdfTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>PDF File</Label>
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".pdf"
                      onChange={handleFileSelect}
                    />
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium">
                          {selectedFile.name}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
                        <p className="text-sm text-muted-foreground">
                          Click to select a PDF file
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleAddPdf}
                  disabled={addPdf.isPending}
                  className="gap-2"
                >
                  {addPdf.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Upload PDF
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !items || items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Brain className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-2">No knowledge base items yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Add URLs (YouTube, Instagram, etc.) and PDF documents to train your AI coach.
              The more content you add, the better your suggestions will be.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getPlatformIcon(item.platform, item.type)}
                    <Badge variant="secondary" className="text-xs">
                      {getPlatformLabel(item.platform, item.type)}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    {item.status === "ready" && getBrainTypeBadge(item.brainType)}
                    {getStatusBadge(item.status)}
                  </div>
                </div>
                <CardTitle className="text-base mt-2 line-clamp-2">
                  {item.title}
                </CardTitle>
                <CardDescription className="text-xs">
                  Added {new Date(item.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 flex-1 flex flex-col">
                {(item.type === "url" || item.type === "video") && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 mb-3"
                  >
                    <LinkIcon className="h-3 w-3" />
                    View Source
                  </a>
                )}

                {/* What I Learned Summary - Only show for ready items */}
                {item.status === "ready" && item.learnedSummary && (
                  <Collapsible 
                    open={expandedItems.has(item.id)}
                    onOpenChange={() => toggleExpanded(item.id)}
                    className="mb-3"
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between p-2 h-auto">
                        <span className="flex items-center gap-2 text-xs font-medium">
                          <Lightbulb className="h-3 w-3 text-yellow-500" />
                          What I Learned
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${expandedItems.has(item.id) ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 pt-2">
                      {/* Summary */}
                      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {item.learnedSummary}
                        </p>
                      </div>

                      {/* Objections Handled */}
                      {item.objectionsHandled && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium flex items-center gap-1">
                            <MessageCircle className="h-3 w-3 text-orange-500" />
                            Objections this helps handle:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {item.objectionsHandled.split(",").map((obj, i) => (
                              <Badge key={i} variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                                {obj.trim()}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Language Styles */}
                      {item.languageStyles && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-purple-500" />
                            Language styles detected:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {item.languageStyles.split(",").map((style, i) => (
                              <Badge key={i} variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                {style.trim()}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Brain Type Selector */}
                      <div className="space-y-2 pt-2 border-t">
                        <Label className="text-xs">Add to Brain:</Label>
                        <Select
                          value={item.brainType || "both"}
                          onValueChange={(value) => setBrainType.mutate({ 
                            id: item.id, 
                            brainType: value as "friend" | "expert" | "both" 
                          })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="friend">
                              <span className="flex items-center gap-2">
                                <Heart className="h-3 w-3 text-pink-500" />
                                Friend Brain
                              </span>
                            </SelectItem>
                            <SelectItem value="expert">
                              <span className="flex items-center gap-2">
                                <Briefcase className="h-3 w-3 text-blue-500" />
                                Expert Brain
                              </span>
                            </SelectItem>
                            <SelectItem value="both">
                              <span className="flex items-center gap-2">
                                <Brain className="h-3 w-3 text-purple-500" />
                                Both
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <div className="flex gap-2 mt-auto">
                  {(item.status === "pending" || item.status === "failed") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => processItem.mutate({ id: item.id })}
                      disabled={processItem.isPending}
                    >
                      {processItem.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      Process
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteItem.mutate({ id: item.id })}
                    disabled={deleteItem.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
