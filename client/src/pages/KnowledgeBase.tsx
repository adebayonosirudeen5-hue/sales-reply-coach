import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Brain,
  Video,
  FileText,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Link as LinkIcon
} from "lucide-react";

export default function KnowledgeBase() {
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [pdfTitle, setPdfTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.knowledgeBase.list.useQuery();

  const addVideo = trpc.knowledgeBase.addVideo.useMutation({
    onSuccess: () => {
      toast.success("Video added to knowledge base!");
      setVideoDialogOpen(false);
      setVideoTitle("");
      setVideoUrl("");
      utils.knowledgeBase.list.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to add video: " + error.message);
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

  const deleteItem = trpc.knowledgeBase.delete.useMutation({
    onSuccess: () => {
      toast.success("Item removed from knowledge base");
      utils.knowledgeBase.list.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  const handleAddVideo = () => {
    if (!videoTitle.trim() || !videoUrl.trim()) {
      toast.error("Please enter both title and URL");
      return;
    }
    addVideo.mutate({ title: videoTitle.trim(), url: videoUrl.trim() });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Knowledge Base
          </h1>
          <p className="text-muted-foreground">
            Train your AI coach with sales videos and documents
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Video className="h-4 w-4" />
                Add Video
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Video URL</DialogTitle>
                <DialogDescription>
                  Add a sales training video URL to your knowledge base
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="video-title">Title</Label>
                  <Input
                    id="video-title"
                    placeholder="e.g., Objection Handling Masterclass"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="video-url">Video URL</Label>
                  <Input
                    id="video-url"
                    placeholder="https://youtube.com/watch?v=..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleAddVideo}
                  disabled={addVideo.isPending}
                  className="gap-2"
                >
                  {addVideo.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add Video
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
              Add sales training videos and PDF documents to train your AI coach.
              The more content you add, the better your suggestions will be.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {item.type === "video" ? (
                      <Video className="h-5 w-5 text-primary" />
                    ) : (
                      <FileText className="h-5 w-5 text-primary" />
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {item.type.toUpperCase()}
                    </Badge>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
                <CardTitle className="text-base mt-2 line-clamp-2">
                  {item.title}
                </CardTitle>
                <CardDescription className="text-xs">
                  Added {new Date(item.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {item.type === "video" && (
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
                <div className="flex gap-2">
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
