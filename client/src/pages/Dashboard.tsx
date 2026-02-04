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
  User
} from "lucide-react";

type SuggestionResult = {
  id: number;
  type: string;
  text: string;
};

type AnalysisResult = {
  conversationId: number;
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
      toast.success("Analysis complete! Here are your suggestions.");
    },
    onError: (error) => {
      toast.error("Failed to analyze: " + error.message);
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

    analyzeConversation.mutate({
      inputText: inputText.trim(),
      screenshotUrl: screenshotUrl || undefined,
      replyMode,
      buyerName: buyerName.trim() || undefined,
    });
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Conversation Coach</h1>
        <p className="text-muted-foreground">
          Upload a screenshot or paste your conversation to get reply suggestions
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5" />
              Your Conversation
            </CardTitle>
            <CardDescription>
              Upload a screenshot or paste the conversation text
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  placeholder="Paste your conversation here...

Example:
Prospect: Hey, I saw your post about the product. How much does it cost?
Me: (what should I say?)"
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
              disabled={analyzeConversation.isPending || !inputText.trim()}
            >
              {analyzeConversation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
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
              <div className="space-y-6">
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
