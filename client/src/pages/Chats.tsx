import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useRoute, useLocation } from "wouter";
import { 
  MessageSquare, Plus, Send, Image, User, Sparkles, 
  ThumbsUp, ThumbsDown, Copy, Check, AlertTriangle,
  Heart, Briefcase, MoreVertical, Trash2, Edit, Target
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Chats() {
  const [, params] = useRoute("/chats/:prospectId");
  const [, setLocation] = useLocation();
  const selectedProspectId = params?.prospectId ? parseInt(params.prospectId) : null;
  
  const [newProspectOpen, setNewProspectOpen] = useState(false);
  const [newProspectName, setNewProspectName] = useState("");
  const [newProspectIg, setNewProspectIg] = useState("");
  const [newProspectTiktok, setNewProspectTiktok] = useState("");
  const [newProspectStore, setNewProspectStore] = useState("");
  
  const [messageInput, setMessageInput] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "screenshot">("text");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{id: number; type: string; text: string; whyThisWorks?: string}>>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [pushyWarning, setPushyWarning] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get active workspace
  const { data: activeWorkspace } = trpc.workspace.getActive.useQuery();
  
  // Get prospects for active workspace
  const { data: prospects, refetch: refetchProspects } = trpc.prospect.list.useQuery(
    { workspaceId: activeWorkspace?.id ?? 0 },
    { enabled: !!activeWorkspace?.id }
  );

  // Get selected prospect data
  const { data: prospectData, refetch: refetchProspect } = trpc.prospect.get.useQuery(
    { id: selectedProspectId ?? 0 },
    { enabled: !!selectedProspectId }
  );

  const createProspect = trpc.prospect.create.useMutation({
    onSuccess: (data) => {
      toast.success("New chat created!");
      setNewProspectOpen(false);
      setNewProspectName("");
      setNewProspectIg("");
      setNewProspectTiktok("");
      setNewProspectStore("");
      refetchProspects();
      setLocation(`/chats/${data.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const analyzeProspect = trpc.prospect.analyzeProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile analyzed! Check suggested first message.");
      refetchProspect();
    },
    onError: (error) => toast.error(error.message),
  });

  const uploadScreenshot = trpc.chat.uploadScreenshot.useMutation({
    onSuccess: (data) => {
      setScreenshotUrl(data.url);
      setExtractedText(data.extractedText);
      setMessageInput(data.extractedText);
      toast.success("Screenshot processed!");
    },
    onError: (error) => toast.error(error.message),
  });

  const sendInbound = trpc.chat.sendInbound.useMutation({
    onSuccess: (data) => {
      setSuggestions(data.suggestions);
      setPushyWarning(data.analysis.pushyWarning);
      setMessageInput("");
      setScreenshotUrl(null);
      setExtractedText("");
      refetchProspect();
      toast.success("Message analyzed!");
    },
    onError: (error) => toast.error(error.message),
  });

  const sendOutbound = trpc.chat.sendOutbound.useMutation({
    onSuccess: () => {
      setSuggestions([]);
      setPushyWarning(null);
      refetchProspect();
      toast.success("Response recorded!");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateProspect = trpc.prospect.update.useMutation({
    onSuccess: () => {
      refetchProspect();
      refetchProspects();
    },
  });

  const deleteProspect = trpc.prospect.delete.useMutation({
    onSuccess: () => {
      toast.success("Chat deleted");
      refetchProspects();
      setLocation("/chats");
    },
    onError: (error) => toast.error(error.message),
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [prospectData?.messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProspectId) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadScreenshot.mutate({
        prospectId: selectedProspectId,
        fileBase64: base64,
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedProspectId) return;
    
    sendInbound.mutate({
      prospectId: selectedProspectId,
      content: messageInput,
      screenshotUrl: screenshotUrl || undefined,
    });
  };

  const handleUseSuggestion = (suggestion: {id: number; text: string}) => {
    if (!selectedProspectId) return;
    
    sendOutbound.mutate({
      prospectId: selectedProspectId,
      content: suggestion.text,
      suggestionId: suggestion.id,
      isAiSuggestion: true,
    });
  };

  const handleCopySuggestion = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Copied to clipboard!");
  };

  const handleCreateProspect = () => {
    if (!newProspectName.trim() || !activeWorkspace?.id) return;
    
    createProspect.mutate({
      workspaceId: activeWorkspace.id,
      name: newProspectName,
      instagramUrl: newProspectIg || undefined,
      tiktokUrl: newProspectTiktok || undefined,
      storeUrl: newProspectStore || undefined,
    });
  };

  if (!activeWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Create a Workspace First</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You need to create a workspace before you can start chatting with prospects.
              A workspace represents your business niche.
            </p>
            <Button onClick={() => setLocation("/workspaces")}>
              Go to Workspaces
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar - Prospect List */}
      <div className="w-80 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Chats</h2>
            <Dialog open={newProspectOpen} onOpenChange={setNewProspectOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Chat</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Prospect Name *</Label>
                    <Input
                      value={newProspectName}
                      onChange={(e) => setNewProspectName(e.target.value)}
                      placeholder="e.g., Sarah, John D."
                    />
                  </div>
                  <div>
                    <Label>Instagram URL</Label>
                    <Input
                      value={newProspectIg}
                      onChange={(e) => setNewProspectIg(e.target.value)}
                      placeholder="https://instagram.com/username"
                    />
                  </div>
                  <div>
                    <Label>TikTok URL</Label>
                    <Input
                      value={newProspectTiktok}
                      onChange={(e) => setNewProspectTiktok(e.target.value)}
                      placeholder="https://tiktok.com/@username"
                    />
                  </div>
                  <div>
                    <Label>Store/Website URL</Label>
                    <Input
                      value={newProspectStore}
                      onChange={(e) => setNewProspectStore(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateProspect} disabled={!newProspectName.trim()}>
                    Create Chat
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <p className="text-xs text-muted-foreground">
            Workspace: {activeWorkspace.name}
          </p>
        </div>
        
        <ScrollArea className="flex-1">
          {prospects?.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No chats yet</p>
              <p className="text-xs">Click "New" to start a conversation</p>
            </div>
          ) : (
            <div className="divide-y">
              {prospects?.map((prospect) => (
                <div
                  key={prospect.id}
                  className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedProspectId === prospect.id ? "bg-muted" : ""
                  }`}
                  onClick={() => setLocation(`/chats/${prospect.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">{prospect.name}</p>
                        {prospect.replyMode === "expert" ? (
                          <Briefcase className="h-3 w-3 text-blue-500" />
                        ) : (
                          <Heart className="h-3 w-3 text-pink-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {prospect.conversationStage?.replace(/_/g, " ")}
                      </p>
                    </div>
                    {prospect.outcome !== "active" && (
                      <Badge variant={prospect.outcome === "won" ? "default" : "secondary"} className="text-xs">
                        {prospect.outcome}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {!selectedProspectId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-medium mb-1">Select a chat</h3>
              <p className="text-sm text-muted-foreground">
                Choose a prospect from the sidebar or create a new chat
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{prospectData?.prospect.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {prospectData?.prospect.detectedInterests || "Click analyze to learn about this prospect"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={prospectData?.prospect.replyMode || "friend"}
                  onValueChange={(value: "friend" | "expert") => {
                    if (selectedProspectId) {
                      updateProspect.mutate({ id: selectedProspectId, replyMode: value });
                    }
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friend">
                      <div className="flex items-center gap-2">
                        <Heart className="h-3 w-3 text-pink-500" />
                        Friend
                      </div>
                    </SelectItem>
                    <SelectItem value="expert">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-3 w-3 text-blue-500" />
                        Expert
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedProspectId && analyzeProspect.mutate({ id: selectedProspectId })}
                  disabled={analyzeProspect.isPending}
                >
                  <Target className="h-4 w-4 mr-1" />
                  Analyze
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        if (selectedProspectId) {
                          updateProspect.mutate({ id: selectedProspectId, outcome: "won" });
                          toast.success("Marked as won!");
                        }
                      }}
                    >
                      Mark as Won
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        if (selectedProspectId) {
                          updateProspect.mutate({ id: selectedProspectId, outcome: "lost" });
                          toast.success("Marked as lost");
                        }
                      }}
                    >
                      Mark as Lost
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        if (selectedProspectId) {
                          updateProspect.mutate({ id: selectedProspectId, outcome: "ghosted" });
                          toast.success("Marked as ghosted");
                        }
                      }}
                    >
                      Mark as Ghosted
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => selectedProspectId && deleteProspect.mutate({ id: selectedProspectId })}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Chat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Suggested First Message (if available and no messages yet) */}
            {prospectData?.prospect.suggestedFirstMessage && prospectData.messages.length === 0 && (
              <div className="p-4 bg-primary/5 border-b">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-1" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Suggested First Message</p>
                    <p className="text-sm text-muted-foreground">{prospectData.prospect.suggestedFirstMessage}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => handleCopySuggestion(0, prospectData.prospect.suggestedFirstMessage!)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {prospectData?.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.direction === "outbound"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {message.screenshotUrl && (
                        <img
                          src={message.screenshotUrl}
                          alt="Screenshot"
                          className="max-w-full rounded mb-2"
                        />
                      )}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      {message.direction === "inbound" && message.detectedTone && (
                        <p className="text-xs mt-1 opacity-70">
                          Tone: {message.detectedTone}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* AI Suggestions */}
            {suggestions.length > 0 && (
              <div className="p-4 border-t bg-muted/30">
                {pushyWarning && (
                  <div className="flex items-center gap-2 text-amber-600 mb-3 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{pushyWarning}</span>
                  </div>
                )}
                <p className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Suggested Replies
                </p>
                <div className="space-y-2">
                  {suggestions.map((suggestion) => (
                    <Card key={suggestion.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <Badge variant="outline" className="mb-2 text-xs">
                            {suggestion.type === "primary" ? "Best Reply" : 
                             suggestion.type === "alternative" ? "Alternative" : "Softer"}
                          </Badge>
                          <p className="text-sm">{suggestion.text}</p>
                          {suggestion.whyThisWorks && (
                            <p className="text-xs text-muted-foreground mt-2">
                              💡 {suggestion.whyThisWorks}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleCopySuggestion(suggestion.id, suggestion.text)}
                          >
                            {copiedId === suggestion.id ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleUseSuggestion(suggestion)}
                          >
                            Use
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t">
              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "text" | "screenshot")}>
                <TabsList className="mb-3">
                  <TabsTrigger value="text">
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Paste Text
                  </TabsTrigger>
                  <TabsTrigger value="screenshot">
                    <Image className="h-4 w-4 mr-1" />
                    Screenshot
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="text" className="mt-0">
                  <div className="flex gap-2">
                    <Textarea
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Paste the prospect's message here..."
                      className="min-h-[80px]"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || sendInbound.isPending}
                      className="self-end"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="screenshot" className="mt-0">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  {screenshotUrl ? (
                    <div className="space-y-3">
                      <img src={screenshotUrl} alt="Uploaded" className="max-h-40 rounded border" />
                      <Textarea
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Extracted text (edit if needed)..."
                        className="min-h-[60px]"
                      />
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => {
                          setScreenshotUrl(null);
                          setMessageInput("");
                        }}>
                          Clear
                        </Button>
                        <Button
                          onClick={handleSendMessage}
                          disabled={!messageInput.trim() || sendInbound.isPending}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Analyze
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full h-24 border-dashed"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadScreenshot.isPending}
                    >
                      <div className="flex flex-col items-center">
                        <Image className="h-6 w-6 mb-2" />
                        <span>{uploadScreenshot.isPending ? "Processing..." : "Click to upload screenshot"}</span>
                      </div>
                    </Button>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
