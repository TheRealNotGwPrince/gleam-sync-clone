import { useState, useEffect } from "react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatWindow } from "./ChatWindow";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  status: string;
  avatar_url?: string;
}

interface ChatLayoutProps {
  currentUser: any;
}

export function ChatLayout({ currentUser }: ChatLayoutProps) {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  useEffect(() => {
    // Update user status to online when component mounts
    updateUserStatus('online');

    // Set up presence tracking for real-time status updates
    const presenceChannel = supabase.channel('user-presence');
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        console.log('Presence sync:', newState);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track user presence
          await presenceChannel.track({
            user_id: currentUser.id,
            online_at: new Date().toISOString(),
            status: 'online'
          });
        }
      });

    // Update status to offline when user leaves
    const handleBeforeUnload = () => {
      updateUserStatus('offline');
    };

    // Handle visibility change for better status tracking
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updateUserStatus('away');
      } else {
        updateUserStatus('online');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      updateUserStatus('offline');
      presenceChannel.unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser.id]);

  const updateUserStatus = async (status: string) => {
    try {
      await supabase
        .from('profiles')
        .update({ 
          status, 
          last_seen: new Date().toISOString() 
        })
        .eq('user_id', currentUser.id);
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const handleSelectChat = (userId: string, profile: Profile) => {
    setSelectedProfile(profile);
  };

  return (
    <div className="h-screen flex bg-background">
      <ChatSidebar 
        currentUser={currentUser}
        onSelectChat={handleSelectChat}
        selectedUserId={selectedProfile?.user_id}
      />
      
      {selectedProfile ? (
        <ChatWindow 
          currentUser={currentUser}
          selectedProfile={selectedProfile}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="space-y-4">
            <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
              <MessageCircle className="h-12 w-12 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold mb-2">Welcome to ChatVibe</h2>
              <p className="text-muted-foreground">
                Select a conversation from the sidebar to start chatting
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}