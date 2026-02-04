import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  History as HistoryIcon,
  MessageSquareText,
  Trash2,
  Loader2,
  Eye,
  Copy,
  Calendar,
  ChevronRight,
  User,
  Search,
  Filter,
  Heart,
  Briefcase,
  Trophy,
  XCircle,
  Clock,
  TrendingUp
} from "lucide-react";

export default function History() {
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [buyerFilter, setBuyerFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [outcomeDialogOpen, setOutcomeDialogOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<"pending" | "won" | "lost">("pending");
  const [outcomeNotes, setOutcomeNotes] = useState("");

  const utils = trpc.useUtils();
  const { data: conversations, isLoading } = trpc.conversation.list.useQuery();
  const { data: conversationDetail } = trpc.conversation.get.useQuery(
    { id: selectedConversation! },
    { enabled: !!selectedConversation }
  );
  const { data: stats } = trpc.conversation.stats.useQuery();

  const deleteConversation = trpc.conversation.delete.useMutation({
    onSuccess: () => {
      toast.success("Conversation deleted");
      utils.conversation.list.invalidate();
      utils.conversation.stats.invalidate();
      setSelectedConversation(null);
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  const updateOutcome = trpc.conversation.updateOutcome.useMutation({
    onSuccess: () => {
      toast.success("Outcome updated!");
      utils.conversation.list.invalidate();
      utils.conversation.stats.invalidate();
      utils.conversation.get.invalidate();
      setOutcomeDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to update: " + error.message);
    },
  });

  // Get unique buyer names for filter dropdown
  const uniqueBuyers = useMemo(() => {
    if (!conversations) return [];
    const buyers = conversations
      .map(c => c.buyerName)
      .filter((name): name is string => !!name);
    return Array.from(new Set(buyers)).sort();
  }, [conversations]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    return conversations.filter(conv => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        conv.title?.toLowerCase().includes(searchLower) ||
        conv.buyerName?.toLowerCase().includes(searchLower);

      // Buyer filter
      const matchesBuyer = buyerFilter === "all" || conv.buyerName === buyerFilter;

      // Mode filter
      const matchesMode = modeFilter === "all" || conv.replyMode === modeFilter;

      // Outcome filter
      const matchesOutcome = outcomeFilter === "all" || conv.outcome === outcomeFilter;

      return matchesSearch && matchesBuyer && matchesMode && matchesOutcome;
    });
  }, [conversations, searchQuery, buyerFilter, modeFilter, outcomeFilter]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const getContextLabel = (context: string | null) => {
    const labels: Record<string, string> = {
      objection: "Objection Handling",
      tone_shift: "Tone Shift",
      referral: "Expert Referral",
      first_message: "First Message",
      follow_up: "Follow Up",
      general: "General",
    };
    return labels[context || "general"] || "General";
  };

  const getContextColor = (context: string | null) => {
    const colors: Record<string, string> = {
      objection: "bg-orange-100 text-orange-800 border-orange-200",
      tone_shift: "bg-purple-100 text-purple-800 border-purple-200",
      referral: "bg-blue-100 text-blue-800 border-blue-200",
      first_message: "bg-green-100 text-green-800 border-green-200",
      follow_up: "bg-cyan-100 text-cyan-800 border-cyan-200",
      general: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[context || "general"] || colors.general;
  };

  const getReplyModeBadge = (mode: string | null) => {
    if (mode === "expert") {
      return (
        <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
          <Briefcase className="h-3 w-3" />
          Expert
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 bg-pink-50 text-pink-700 border-pink-200">
        <Heart className="h-3 w-3" />
        Friend
      </Badge>
    );
  };

  const getOutcomeBadge = (outcome: string | null) => {
    if (outcome === "won") {
      return (
        <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
          <Trophy className="h-3 w-3" />
          Won
        </Badge>
      );
    }
    if (outcome === "lost") {
      return (
        <Badge variant="outline" className="gap-1 bg-red-50 text-red-700 border-red-200">
          <XCircle className="h-3 w-3" />
          Lost
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 bg-gray-50 text-gray-700 border-gray-200">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    );
  };

  const openOutcomeDialog = (conv: { id: number; outcome: string | null; outcomeNotes: string | null }) => {
    setSelectedConversation(conv.id);
    setSelectedOutcome((conv.outcome as "pending" | "won" | "lost") || "pending");
    setOutcomeNotes(conv.outcomeNotes || "");
    setOutcomeDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <HistoryIcon className="h-6 w-6" />
          Conversation History
        </h1>
        <p className="text-muted-foreground">
          Review past conversations, track outcomes, and measure success
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Conversations</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Won</CardDescription>
              <CardTitle className="text-2xl text-green-600">{stats.won}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Conversion Rate</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {stats.conversionRate}%
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>By Mode</CardDescription>
              <div className="flex gap-4 mt-1">
                <div className="text-sm">
                  <span className="text-pink-600">Friend:</span> {stats.friendMode.conversionRate}%
                </div>
                <div className="text-sm">
                  <span className="text-blue-600">Expert:</span> {stats.expertMode.conversionRate}%
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Filters */}
      {conversations && conversations.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {uniqueBuyers.length > 0 && (
              <Select value={buyerFilter} onValueChange={setBuyerFilter}>
                <SelectTrigger className="w-[140px]">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Buyers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buyers</SelectItem>
                  {uniqueBuyers.map(buyer => (
                    <SelectItem key={buyer} value={buyer}>{buyer}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-[130px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Modes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="friend">Friend</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
              </SelectContent>
            </Select>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger className="w-[130px]">
                <Trophy className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Outcomes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !conversations || conversations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquareText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-2">No conversations yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Your analyzed conversations will appear here. Go to the Dashboard to analyze your first conversation.
            </p>
          </CardContent>
        </Card>
      ) : filteredConversations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-2">No matching conversations</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Try adjusting your search or filters to find what you're looking for.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredConversations.map((conv) => (
            <Card
              key={conv.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div 
                    className="space-y-1 flex-1"
                    onClick={() => setSelectedConversation(conv.id)}
                  >
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquareText className="h-4 w-4 text-primary" />
                      {conv.title || "Untitled Conversation"}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(conv.createdAt).toLocaleString()}
                      </span>
                      {conv.buyerName && (
                        <span className="flex items-center gap-1 text-primary">
                          <User className="h-3 w-3" />
                          {conv.buyerName}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getReplyModeBadge(conv.replyMode)}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 h-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        openOutcomeDialog(conv);
                      }}
                    >
                      {getOutcomeBadge(conv.outcome)}
                    </Button>
                    <ChevronRight 
                      className="h-4 w-4 text-muted-foreground cursor-pointer"
                      onClick={() => setSelectedConversation(conv.id)}
                    />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Conversation Detail Dialog */}
      <Dialog
        open={!!selectedConversation && !outcomeDialogOpen}
        onOpenChange={(open) => !open && setSelectedConversation(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {conversationDetail?.conversation.title || "Conversation Details"}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-3">
              {conversationDetail?.conversation.createdAt &&
                new Date(conversationDetail.conversation.createdAt).toLocaleString()}
              {conversationDetail?.conversation.buyerName && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {conversationDetail.conversation.buyerName}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {conversationDetail && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Mode and Outcome */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Status</h4>
                  <div className="flex flex-wrap gap-2">
                    {getReplyModeBadge(conversationDetail.conversation.replyMode)}
                    {getOutcomeBadge(conversationDetail.conversation.outcome)}
                  </div>
                  {conversationDetail.conversation.outcomeNotes && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Notes: {conversationDetail.conversation.outcomeNotes}
                    </p>
                  )}
                </div>

                {/* Messages in Thread */}
                {conversationDetail.messages && conversationDetail.messages.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Conversation Thread ({conversationDetail.messages.length} messages)</h4>
                    <div className="space-y-3">
                      {conversationDetail.messages.map((msg, idx) => (
                        <div key={msg.id} className="bg-muted/50 rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              Message {idx + 1} • {new Date(msg.createdAt).toLocaleString()}
                            </span>
                            <div className="flex gap-1">
                              {msg.analysisContext && (
                                <Badge variant="outline" className={getContextColor(msg.analysisContext)}>
                                  {getContextLabel(msg.analysisContext)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.inputText}</p>
                          {msg.detectedTone && (
                            <p className="text-xs text-muted-foreground">
                              Detected tone: {msg.detectedTone}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Suggestions Generated</h4>
                  <div className="space-y-3">
                    {conversationDetail.suggestions.map((sug) => (
                      <div
                        key={sug.id}
                        className="border rounded-lg p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">
                            {sug.suggestionType === "primary"
                              ? "Recommended"
                              : sug.suggestionType === "alternative"
                              ? "Alternative"
                              : "Expert Referral"}
                          </Badge>
                          <div className="flex items-center gap-2">
                            {sug.wasUsed === "yes" && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Used
                              </Badge>
                            )}
                            {sug.feedback === "helpful" && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                Helpful
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm">{sug.suggestionText}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => copyToClipboard(sug.suggestionText)}
                        >
                          <Copy className="h-3 w-3" />
                          Copy
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      if (conversationDetail) {
                        openOutcomeDialog({
                          id: conversationDetail.conversation.id,
                          outcome: conversationDetail.conversation.outcome,
                          outcomeNotes: conversationDetail.conversation.outcomeNotes,
                        });
                      }
                    }}
                  >
                    <Trophy className="h-4 w-4" />
                    Update Outcome
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      if (selectedConversation) {
                        deleteConversation.mutate({ id: selectedConversation });
                      }
                    }}
                    disabled={deleteConversation.isPending}
                  >
                    {deleteConversation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Outcome Update Dialog */}
      <Dialog open={outcomeDialogOpen} onOpenChange={setOutcomeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Conversation Outcome</DialogTitle>
            <DialogDescription>
              Track whether this conversation led to a successful sale
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Outcome</Label>
              <Select value={selectedOutcome} onValueChange={(v) => setSelectedOutcome(v as "pending" | "won" | "lost")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      Pending
                    </span>
                  </SelectItem>
                  <SelectItem value="won">
                    <span className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-green-500" />
                      Won
                    </span>
                  </SelectItem>
                  <SelectItem value="lost">
                    <span className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Lost
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes about the outcome..."
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOutcomeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedConversation) {
                  updateOutcome.mutate({
                    id: selectedConversation,
                    outcome: selectedOutcome,
                    outcomeNotes: outcomeNotes || undefined,
                  });
                }
              }}
              disabled={updateOutcome.isPending}
            >
              {updateOutcome.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
