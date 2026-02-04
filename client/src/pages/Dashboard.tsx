import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Upload, 
  MessageSquareText, 
  Copy, 
  ThumbsUp, 
  ThumbsDown,
  Loader2,
  ImageIcon,
  FileText,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Heart,
  Briefcase,
  User,
  Plus,
  MessageCircle,
  RotateCcw
} from "lucide-react";

type SuggestionResult = {
  id: number;
  type: string;
  text: string;
};

type AnalysisResult = {
  conversationId: number;
  messageId?: number;
  analysis: {
    contextType: string;
    detectedTone: string;
    reasoning: string;
  };
  suggestions: SuggestionResult[];
};

type ThreadMessage = {
  inputText: string;
  analysis: {
    contextType: string;
    detectedTone: string;
    reasoning: string;
  };
  suggestions: SuggestionResult[];
};

export default function Dashboard() {
  const [inputText, setInputText] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [replyMode, setReplyMode] = useState<"friend" | "expert">("friend");
  const [buyerName, setBuyerName] = useState("");
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadScreenshot = trpc.conversation.uploadScreenshot.useMutation({
    onSuccess: (data) => {
      setScreenshotUrl(data.url);
      setExtractedText(data.extractedText);
      setInputText(data.extractedText);
      toast.success("Screenshot uploaded and text extracted!");
      setIsUploading(false);
    },
    onError: (error) => {
      toast.error("Failed to upload screenshot: " + error.message);
      setIsUploading(false);
    },
  });

  const analyzeConversation = trpc.conversation.analyze.useMutation({
    onSuccess: (data) => {
      setAnalysisResult(data);
      setCurrentConversationId(data.conversationId);
      setThreadMessages([{
        inputText: inputText,
        analysis: data.analysis,
        suggestions: data.suggestions,
      }]);
      toast.success("Analysis complete! Here are your suggestions.");
      setInputText("");
      setScreenshotUrl(null);
      setExtractedText("");
    },
    onError: (error) => {
      toast.error("Failed to analyze: " + error.message);
    },
  });

  const addMessage = trpc.conversation.addMessage.useMutation({
    onSuccess: (data) => {
      setAnalysisResult({
        conversationId: currentConversationId!,
        messageId: data.messageId,
        analysis: data.analysis,
        suggestions: data.suggestions,
      });
      setThreadMessages(prev => [...prev, {
        inputText: inputText,
        analysis: data.analysis,
        suggestions: data.suggestions,
      }]);
      toast.success("Follow-up analyzed! Here are your new suggestions.");
      setInputText("");
      setScreenshotUrl(null);
      setExtractedText("");
    },
    onError: (error) => {
      toast.error("Failed to analyze follow-up: " + error.message);
    },
  });

  const markUsed = trpc.suggestion.markUsed.useMutation({
    onSuccess: () => {
      toast.success("Marked as used!");
    },
  });

  const giveFeedback = trpc.suggestion.feedback.useMutation({
    onSuccess: () => {
      toast.success("Thanks for your feedback!");
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadScreenshot.mutate({
        fileBase64: base64,
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = () => {
    if (!inputText.trim()) {
      toast.error("Please enter or upload a conversation first");
      return;
    }

    if (currentConversationId) {
      // Add to existing conversation thread
      addMessage.mutate({
        conversationId: currentConversationId,
        inputText: inputText.trim(),
        screenshotUrl: screenshotUrl || undefined,
      });
    } else {
      // Start new conversation
      analyzeConversation.mutate({
        inputText: inputText.trim(),
        screenshotUrl: screenshotUrl || undefined,
        replyMode,
        buyerName: buyerName.trim() || undefined,
      });
    }
  };

  const startNewConversation = () => {
    setCurrentConversationId(null);
    setAnalysisResult(null);
    setThreadMessages([]);
    setInputText("");
    setScreenshotUrl(null);
    setExtractedText("");
    setBuyerName("");
    setReplyMode("friend");
    toast.info("Started a new conversation");
  };

  const copyToClipboard = (text: string, suggestionId: number) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
    markUsed.mutate({ id: suggestionId, wasUsed: "yes" });
  };

  const getContextBadgeColor = (context: string) => {
    const colors: Record<string, string> = {
      objection: "bg-orange-100 text-orange-800 border-orange-200",
      tone_shift: "bg-purple-100 text-purple-800 border-purple-200",
      referral: "bg-blue-100 text-blue-800 border-blue-200",
      first_message: "bg-green-100 text-green-800 border-green-200",
      follow_up: "bg-cyan-100 text-cyan-800 border-cyan-200",
      general: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[context] || colors.general;
  };

  const getSuggestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      primary: "Recommended",
      alternative: "Alternative",
      expert_referral: "Expert Referral",
    };
    return labels[type] || type;
  };

  const isAnalyzing = analyzeConversation.isPending || addMessage.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversation Coach</h1>
          <p className="text-muted-foreground">
            Upload a screenshot or paste your conversation to get reply suggestions
          </p>
        </div>
        {currentConversationId && (
          <Button variant="outline" className="gap-2" onClick={startNewConversation}>
            <RotateCcw className="h-4 w-4" />
            New Conversation
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5" />
              {currentConversationId ? "Add Follow-up Message" : "Your Conversation"}
            </CardTitle>
            <CardDescription>
              {currentConversationId 
                ? "Continue the conversation thread with a new message"
                : "Upload a screenshot or paste the conversation text"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Show thread indicator if in a conversation */}
            {currentConversationId && (
              <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <MessageCircle className="h-4 w-4 text-primary" />
                <span className="text-sm">
                  <span className="font-medium">Thread active</span>
                  <span className="text-muted-foreground"> • {threadMessages.length} message{threadMessages.length !== 1 ? 's' : ''}</span>
                  {buyerName && <span className="text-muted-foreground"> • {buyerName}</span>}
                </span>
              </div>
            )}

            {/* Only show buyer name and mode toggle for new conversations */}
            {!currentConversationId && (
              <>
                {/* Buyer Name Input */}
                <div className="space-y-2">
                  <Label htmlFor="buyerName" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Prospect/Buyer Name (optional)
                  </Label>
                  <Input
                    id="buyerName"
                    placeholder="e.g., Sarah, John D., @username"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tag this conversation to easily find it later
                  </p>
                </div>

                {/* Friend/Expert Mode Toggle */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${replyMode === "friend" ? "bg-pink-100" : "bg-blue-100"}`}>
                      {replyMode === "friend" ? (
                        <Heart className="h-5 w-5 text-pink-600" />
                      ) : (
                        <Briefcase className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {replyMode === "friend" ? "Friend Mode" : "Expert Mode"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {replyMode === "friend" 
                          ? "Warm, casual, relationship-focused" 
                          : "Professional, direct, solution-focused"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="mode-toggle" className="text-xs text-muted-foreground">
                      {replyMode === "friend" ? "Friend" : "Expert"}
                    </Label>
                    <Switch
                      id="mode-toggle"
                      checked={replyMode === "expert"}
                      onCheckedChange={(checked) => setReplyMode(checked ? "expert" : "friend")}
                    />
                  </div>
                </div>
              </>
            )}

            <Tabs defaultValue="text" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Paste Text
                </TabsTrigger>
                <TabsTrigger value="screenshot" className="gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Screenshot
                </TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="space-y-4">
                <Textarea
                  placeholder={currentConversationId 
                    ? "Paste the prospect's response or your follow-up question..."
                    : `Paste your conversation here...

Example:
Prospect: Hey, I saw your post about the product. How much does it cost?
Me: (what should I say?)`}
                  className="min-h-[200px] resize-none"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
              </TabsContent>
              <TabsContent value="screenshot" className="space-y-4">
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileUpload}
                  />
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">
                        Uploading and extracting text...
                      </p>
                    </div>
                  ) : screenshotUrl ? (
                    <div className="space-y-2">
                      <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
                      <p className="text-sm font-medium">Screenshot uploaded!</p>
                      <p className="text-xs text-muted-foreground">
                        Click to upload a different image
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                      <p className="text-sm font-medium">
                        Click to upload a screenshot
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG up to 10MB
                      </p>
                    </div>
                  )}
                </div>
                {extractedText && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Extracted Text:</label>
                    <Textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="min-h-[150px] resize-none"
                      placeholder="Extracted text will appear here..."
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !inputText.trim()}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : currentConversationId ? (
                <>
                  <Plus className="h-4 w-4" />
                  Add to Thread & Get Suggestions
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Get Reply Suggestions
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Suggested Replies
            </CardTitle>
            <CardDescription>
              AI-powered suggestions based on your knowledge base
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!analysisResult ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  Enter a conversation and click "Get Reply Suggestions" to see AI-powered recommendations
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-6">
                  {/* Thread History */}
                  {threadMessages.length > 1 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground">Conversation Thread</h4>
                      {threadMessages.slice(0, -1).map((msg, idx) => (
                        <div key={idx} className="bg-muted/30 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              Message {idx + 1}
                            </Badge>
                            <Badge variant="outline" className={`text-xs ${getContextBadgeColor(msg.analysis.contextType)}`}>
                              {msg.analysis.contextType.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{msg.inputText}</p>
                        </div>
                      ))}
                      <Separator />
                    </div>
                  )}

                  {/* Current Analysis */}
                  <div className="space-y-4">
                    {threadMessages.length > 1 && (
                      <h4 className="text-sm font-semibold">Latest Message Analysis</h4>
                    )}
                    
                    {/* Analysis Context */}
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={getContextBadgeColor(analysisResult.analysis.contextType)}
                      >
                        {analysisResult.analysis.contextType.replace("_", " ")}
                      </Badge>
                      <Badge variant="outline">
                        Tone: {analysisResult.analysis.detectedTone}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={replyMode === "friend" 
                          ? "bg-pink-50 text-pink-700 border-pink-200" 
                          : "bg-blue-50 text-blue-700 border-blue-200"}
                      >
                        {replyMode === "friend" ? "Friend Mode" : "Expert Mode"}
                      </Badge>
                    </div>

                    {/* Reasoning */}
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Analysis: </span>
                        {analysisResult.analysis.reasoning}
                      </p>
                    </div>

                    {/* Suggestions */}
                    <div className="space-y-4">
                      {analysisResult.suggestions.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className="border rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary">
                              {getSuggestionTypeLabel(suggestion.type)}
                            </Badge>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  giveFeedback.mutate({
                                    id: suggestion.id,
                                    feedback: "helpful",
                                  })
                                }
                              >
                                <ThumbsUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  giveFeedback.mutate({
                                    id: suggestion.id,
                                    feedback: "not_helpful",
                                  })
                                }
                              >
                                <ThumbsDown className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm leading-relaxed">{suggestion.text}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() =>
                              copyToClipboard(suggestion.text, suggestion.id)
                            }
                          >
                            <Copy className="h-3 w-3" />
                            Copy to Clipboard
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
