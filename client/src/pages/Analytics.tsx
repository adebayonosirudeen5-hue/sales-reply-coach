import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, Trophy, XCircle, Ghost, TrendingUp, 
  Heart, Briefcase, Target, Brain, Zap, 
  MessageSquare, Lightbulb, BarChart3
} from "lucide-react";

function formatCategory(cat: string) {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getCategoryColor(cat: string) {
  const colors: Record<string, string> = {
    audience_insight: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    emotional_trigger: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    strategic_question: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    need_identification: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    conversation_pattern: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    pain_discovery: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    rapport_building: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    psychology_insight: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    closing_techniques: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    objection_handling: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
    general_wisdom: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    opening_lines: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
    trust_building: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
    language_pattern: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  };
  return colors[cat] || "bg-gray-100 text-gray-800";
}

function getStageLabel(stage: string) {
  const labels: Record<string, string> = {
    first_contact: "First Contact",
    warm_rapport: "Warm Rapport",
    pain_discovery: "Pain Discovery",
    objection_resistance: "Objection Handling",
    trust_reinforcement: "Trust Building",
    referral_to_expert: "Referral to Expert",
    expert_close: "Expert Close",
  };
  return labels[stage] || stage;
}

export default function Analytics() {
  const { data: activeWorkspace } = trpc.workspace.getActive.useQuery();
  const { data: stats } = trpc.analytics.getStats.useQuery(
    { workspaceId: activeWorkspace?.id },
    { enabled: !!activeWorkspace?.id }
  );
  const { data: insights } = trpc.analytics.getLearningInsights.useQuery();
  const { data: stages } = trpc.analytics.getStageDistribution.useQuery(
    { workspaceId: activeWorkspace?.id },
    { enabled: !!activeWorkspace?.id }
  );

  if (!activeWorkspace) {
    return (
      <div className="container py-8 max-w-4xl">
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium mb-2">No workspace selected</h3>
            <p className="text-muted-foreground">
              Create or select a workspace to view analytics
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalInsights = insights?.totalInsights || 0;
  const fromConversations = insights?.fromConversations || 0;
  const fromContent = insights?.fromContent || 0;

  return (
    <div className="container py-8 max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Analytics & AI Learning
        </h1>
        <p className="text-muted-foreground">
          Track performance for {activeWorkspace.name} and see what your AI has learned
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
                <p className="text-sm text-muted-foreground">Total Prospects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.won || 0}</p>
                <p className="text-sm text-muted-foreground">Won</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Brain className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalInsights}</p>
                <p className="text-sm text-muted-foreground">AI Insights</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{fromConversations}</p>
                <p className="text-sm text-muted-foreground">Learned from Chats</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Overall Conversion Rate
          </CardTitle>
          <CardDescription>
            Percentage of closed conversations that resulted in a win
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={stats?.conversionRate || 0} className="flex-1" />
            <span className="text-2xl font-bold">{stats?.conversionRate || 0}%</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {stats?.won || 0} won out of {(stats?.won || 0) + (stats?.lost || 0)} closed conversations
          </p>
        </CardContent>
      </Card>

      {/* Mode Comparison */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-500" />
              Friend Mode
            </CardTitle>
            <CardDescription>Warm, casual conversation style</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Prospects</span>
                <Badge variant="secondary">{stats?.friendMode?.total || 0}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Won</span>
                <Badge variant="default" className="bg-green-500">{stats?.friendMode?.won || 0}</Badge>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Conversion Rate</span>
                  <span className="font-bold">{stats?.friendMode?.conversionRate || 0}%</span>
                </div>
                <Progress value={stats?.friendMode?.conversionRate || 0} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-500" />
              Expert Mode
            </CardTitle>
            <CardDescription>Professional Team Legacy expert style</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Prospects</span>
                <Badge variant="secondary">{stats?.expertMode?.total || 0}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Won</span>
                <Badge variant="default" className="bg-green-500">{stats?.expertMode?.won || 0}</Badge>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Conversion Rate</span>
                  <span className="font-bold">{stats?.expertMode?.conversionRate || 0}%</span>
                </div>
                <Progress value={stats?.expertMode?.conversionRate || 0} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage Distribution */}
      {stages && stages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Conversation Stage Distribution
            </CardTitle>
            <CardDescription>Where your prospects are in the sales funnel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stages.map((stage: any) => (
                <div key={stage.stage} className="flex items-center gap-4">
                  <div className="w-40 text-sm font-medium">{getStageLabel(stage.stage)}</div>
                  <div className="flex-1">
                    <div className="h-6 bg-muted rounded-full overflow-hidden flex">
                      {stage.won > 0 && (
                        <div
                          className="h-full bg-green-500 flex items-center justify-center text-xs text-white font-medium"
                          style={{ width: `${(stage.won / stage.total) * 100}%`, minWidth: '20px' }}
                        >
                          {stage.won}
                        </div>
                      )}
                      {stage.active > 0 && (
                        <div
                          className="h-full bg-blue-500 flex items-center justify-center text-xs text-white font-medium"
                          style={{ width: `${(stage.active / stage.total) * 100}%`, minWidth: '20px' }}
                        >
                          {stage.active}
                        </div>
                      )}
                      {stage.lost > 0 && (
                        <div
                          className="h-full bg-red-400 flex items-center justify-center text-xs text-white font-medium"
                          style={{ width: `${(stage.lost / stage.total) * 100}%`, minWidth: '20px' }}
                        >
                          {stage.lost}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="w-20 text-right">
                    <Badge variant="outline">{stage.winRate}% win</Badge>
                  </div>
                </div>
              ))}
              <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Won</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Active</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> Lost</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Knowledge Breakdown */}
      {insights?.categoryCounts && Object.keys(insights.categoryCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Knowledge Breakdown
            </CardTitle>
            <CardDescription>
              {fromContent} from training content + {fromConversations} learned from conversations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(insights.categoryCounts).map(([cat, count]) => (
                <Badge key={cat} className={`${getCategoryColor(cat)} text-sm py-1 px-3`}>
                  {formatCategory(cat)}: {count as number}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Learning Insights Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            What Your AI Has Learned
          </CardTitle>
          <CardDescription>
            Insights extracted from conversations and training content - the AI gets smarter with every interaction
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="audience" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="audience" className="text-xs">
                <Users className="h-3 w-3 mr-1" /> Audience
              </TabsTrigger>
              <TabsTrigger value="triggers" className="text-xs">
                <Zap className="h-3 w-3 mr-1" /> Triggers
              </TabsTrigger>
              <TabsTrigger value="questions" className="text-xs">
                <MessageSquare className="h-3 w-3 mr-1" /> Questions
              </TabsTrigger>
              <TabsTrigger value="needs" className="text-xs">
                <Target className="h-3 w-3 mr-1" /> Needs
              </TabsTrigger>
              <TabsTrigger value="patterns" className="text-xs">
                <Lightbulb className="h-3 w-3 mr-1" /> Patterns
              </TabsTrigger>
            </TabsList>

            <TabsContent value="audience" className="mt-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Audience Insights</h4>
                <p className="text-xs text-muted-foreground mb-3">What the AI has learned about your audience types, motivations, and behaviors</p>
                {insights?.audienceInsights && insights.audienceInsights.length > 0 ? (
                  <div className="space-y-2">
                    {insights.audienceInsights.map((insight: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/50 border text-sm">
                        <p>{insight.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(insight.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No audience insights yet. Start conversations and the AI will learn about your audience.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="triggers" className="mt-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Emotional Triggers</h4>
                <p className="text-xs text-muted-foreground mb-3">Words and approaches that trigger positive emotional responses from prospects</p>
                {insights?.emotionalTriggers && insights.emotionalTriggers.length > 0 ? (
                  <div className="space-y-2">
                    {insights.emotionalTriggers.map((trigger: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/50 border text-sm">
                        <p>{trigger.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(trigger.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No emotional triggers identified yet. The AI will learn what resonates with your prospects.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="questions" className="mt-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Strategic Questions</h4>
                <p className="text-xs text-muted-foreground mb-3">Questions that effectively move conversations from general to specific, leading to expert referral</p>
                {insights?.strategicQuestions && insights.strategicQuestions.length > 0 ? (
                  <div className="space-y-2">
                    {insights.strategicQuestions.map((q: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/50 border text-sm">
                        <p>{q.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(q.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No strategic questions learned yet. The AI will discover which questions work best.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="needs" className="mt-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Need Identification</h4>
                <p className="text-xs text-muted-foreground mb-3">Specific needs identified across all prospects - the foundation of the sales process</p>
                {insights?.needIdentifications && insights.needIdentifications.length > 0 ? (
                  <div className="space-y-2">
                    {insights.needIdentifications.map((need: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/50 border text-sm">
                        <p>{need.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(need.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No needs identified yet. The AI will learn what your prospects truly need.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="patterns" className="mt-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Conversation Patterns</h4>
                <p className="text-xs text-muted-foreground mb-3">Successful approaches and patterns that lead to conversions</p>
                {insights?.conversationPatterns && insights.conversationPatterns.length > 0 ? (
                  <div className="space-y-2">
                    {insights.conversationPatterns.map((pattern: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/50 border text-sm">
                        <p>{pattern.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(pattern.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No patterns identified yet. The AI will discover what works best in your niche.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Active Prospects */}
      <Card>
        <CardHeader>
          <CardTitle>Active Conversations</CardTitle>
          <CardDescription>Prospects currently in your pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold">{stats?.active || 0}</span>
            </div>
            <div>
              <p className="font-medium">Active prospects</p>
              <p className="text-sm text-muted-foreground">
                Keep following up to close these conversations
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
