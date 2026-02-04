import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Users, Trophy, XCircle, Ghost, TrendingUp, 
  Heart, Briefcase, Target
} from "lucide-react";

export default function Analytics() {
  const { data: activeWorkspace } = trpc.workspace.getActive.useQuery();
  const { data: stats } = trpc.prospect.stats.useQuery(
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

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Track your conversion rates and performance for {activeWorkspace.name}
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.lost || 0}</p>
                <p className="text-sm text-muted-foreground">Lost</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-500/10 flex items-center justify-center">
                <Ghost className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.ghosted || 0}</p>
                <p className="text-sm text-muted-foreground">Ghosted</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Rate */}
      <Card className="mb-8">
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
            <CardDescription>
              Warm, casual conversation style
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Prospects</span>
                <Badge variant="secondary">{stats?.friendMode.total || 0}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Won</span>
                <Badge variant="default" className="bg-green-500">{stats?.friendMode.won || 0}</Badge>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Conversion Rate</span>
                  <span className="font-bold">{stats?.friendMode.conversionRate || 0}%</span>
                </div>
                <Progress value={stats?.friendMode.conversionRate || 0} className="h-2" />
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
            <CardDescription>
              Professional, direct conversation style
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Prospects</span>
                <Badge variant="secondary">{stats?.expertMode.total || 0}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Won</span>
                <Badge variant="default" className="bg-green-500">{stats?.expertMode.won || 0}</Badge>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Conversion Rate</span>
                  <span className="font-bold">{stats?.expertMode.conversionRate || 0}%</span>
                </div>
                <Progress value={stats?.expertMode.conversionRate || 0} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Prospects */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Active Conversations</CardTitle>
          <CardDescription>
            Prospects currently in your pipeline
          </CardDescription>
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
