import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  User,
  Briefcase,
  MessageCircle,
  Save,
  Loader2
} from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const { data: profile, isLoading } = trpc.profile.get.useQuery();

  const [formData, setFormData] = useState({
    salesStyle: "",
    industry: "",
    productDescription: "",
    tonePreference: "",
    companyName: "",
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        salesStyle: profile.salesStyle || "",
        industry: profile.industry || "",
        productDescription: profile.productDescription || "",
        tonePreference: profile.tonePreference || "",
        companyName: profile.companyName || "",
      });
    }
  }, [profile]);

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to update profile: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({
      salesStyle: formData.salesStyle || null,
      industry: formData.industry || null,
      productDescription: formData.productDescription || null,
      tonePreference: formData.tonePreference || null,
      companyName: formData.companyName || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Customize your profile to get personalized suggestions
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>
              Your basic account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={user?.name || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-5 w-5" />
              Sales Profile
            </CardTitle>
            <CardDescription>
              Help the AI understand your sales context
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  placeholder="Your company or brand name"
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData({ ...formData, companyName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  placeholder="e.g., Health & Wellness, Tech, Finance"
                  value={formData.industry}
                  onChange={(e) =>
                    setFormData({ ...formData, industry: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="productDescription">Product/Service Description</Label>
              <Textarea
                id="productDescription"
                placeholder="Briefly describe what you sell or promote..."
                className="min-h-[100px]"
                value={formData.productDescription}
                onChange={(e) =>
                  setFormData({ ...formData, productDescription: e.target.value })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Communication Style */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="h-5 w-5" />
              Communication Style
            </CardTitle>
            <CardDescription>
              Set your preferred sales approach and tone
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="salesStyle">Sales Style</Label>
                <Select
                  value={formData.salesStyle}
                  onValueChange={(value) =>
                    setFormData({ ...formData, salesStyle: value })
                  }
                >
                  <SelectTrigger id="salesStyle">
                    <SelectValue placeholder="Select your style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultative">
                      Consultative - Ask questions, understand needs
                    </SelectItem>
                    <SelectItem value="direct">
                      Direct - Straightforward, to the point
                    </SelectItem>
                    <SelectItem value="friendly">
                      Friendly - Warm, relationship-focused
                    </SelectItem>
                    <SelectItem value="educational">
                      Educational - Teach and inform
                    </SelectItem>
                    <SelectItem value="storytelling">
                      Storytelling - Share experiences and examples
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tonePreference">Tone Preference</Label>
                <Select
                  value={formData.tonePreference}
                  onValueChange={(value) =>
                    setFormData({ ...formData, tonePreference: value })
                  }
                >
                  <SelectTrigger id="tonePreference">
                    <SelectValue placeholder="Select your tone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">
                      Professional - Polished and business-like
                    </SelectItem>
                    <SelectItem value="casual">
                      Casual - Relaxed and conversational
                    </SelectItem>
                    <SelectItem value="warm">
                      Warm - Friendly and approachable
                    </SelectItem>
                    <SelectItem value="enthusiastic">
                      Enthusiastic - Energetic and excited
                    </SelectItem>
                    <SelectItem value="empathetic">
                      Empathetic - Understanding and supportive
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            className="gap-2"
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
