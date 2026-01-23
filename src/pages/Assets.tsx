import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, Upload, Image, Video, FileText, File } from "lucide-react";
import { Button } from "@/components/ui/button";

const assetCategories = [
  { id: "headshots", label: "Headshots", icon: Image, count: 0 },
  { id: "speaker_reels", label: "Speaker Reels", icon: Video, count: 0 },
  { id: "one_sheets", label: "One Sheets", icon: FileText, count: 0 },
  { id: "slide_decks", label: "Slide Decks", icon: File, count: 0 },
];

const Assets = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FolderOpen className="h-6 w-6 text-violet-600" />
              Speaker Assets
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your headshots, speaker reels, and marketing materials
            </p>
          </div>
          <Button className="bg-violet-600 hover:bg-violet-700">
            <Upload className="h-4 w-4 mr-2" />
            Upload Asset
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {assetCategories.map((category) => (
            <Card key={category.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-100 flex items-center justify-center">
                  <category.icon className="h-8 w-8 text-violet-600" />
                </div>
                <h3 className="font-medium text-foreground">{category.label}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {category.count} files
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p>No assets uploaded yet</p>
              <p className="text-sm mt-1">Upload your first headshot or speaker reel to get started</p>
              <Button variant="outline" className="mt-4">
                <Upload className="h-4 w-4 mr-2" />
                Upload Your First Asset
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Assets;
