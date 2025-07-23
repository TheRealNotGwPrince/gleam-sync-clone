import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Search, MessageCircle, Users, Settings, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  status: string;
  avatar_url?: string;
  last_seen: string;
}

interface ChatSidebarProps {
  currentUser: any;
  onSelectChat: (userId: string, profile: Profile) => void;
  selectedUserId?: string;
}

export function ChatSidebar({ currentUser, onSelectChat, selectedUserId }: ChatSidebarProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfiles();
    
    // Subscribe to profiles changes
    const subscription = supabase
      .channel('profiles-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchProfiles()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('user_id', currentUser?.id)
        .order('last_seen', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast({
        title: "Error",
        description: "Failed to load contacts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const filteredProfiles = profiles.filter(profile =>
    profile.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-chat-online';
      case 'away': return 'bg-chat-away';
      default: return 'bg-chat-offline';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (loading) {
    return (
      <div className="w-80 bg-chat-sidebar border-r border-border flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-chat-sidebar border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold">ChatVibe</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Current User */}
        <Card className="p-3 bg-card/50">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={currentUser?.user_metadata?.avatar_url} />
                <AvatarFallback>{getInitials(currentUser?.user_metadata?.display_name || 'U')}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-chat-online rounded-full border-2 border-card"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{currentUser?.user_metadata?.display_name || 'You'}</p>
              <p className="text-sm text-muted-foreground truncate">@{currentUser?.user_metadata?.username}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Contacts List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredProfiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No contacts found</p>
            </div>
          ) : (
            filteredProfiles.map((profile) => (
              <Button
                key={profile.id}
                variant={selectedUserId === profile.user_id ? "secondary" : "ghost"}
                className="w-full justify-start p-3 h-auto mb-1"
                onClick={() => onSelectChat(profile.user_id, profile)}
              >
                <div className="flex items-center space-x-3 w-full">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile.avatar_url} />
                      <AvatarFallback>{getInitials(profile.display_name || profile.username)}</AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(profile.status)} rounded-full border-2 border-card`}></div>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium truncate">{profile.display_name || profile.username}</p>
                    <p className="text-sm text-muted-foreground truncate">@{profile.username}</p>
                    {profile.bio && (
                      <p className="text-xs text-muted-foreground truncate mt-1">{profile.bio}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {profile.status}
                  </Badge>
                </div>
              </Button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}