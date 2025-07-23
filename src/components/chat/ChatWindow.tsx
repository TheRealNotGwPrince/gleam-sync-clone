import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Send, Phone, Video, MoreVertical, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { encryptMessage, decryptMessage } from "@/lib/encryption";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  status: string;
  avatar_url?: string;
}

interface ChatWindowProps {
  currentUser: any;
  selectedProfile: Profile;
}

export function ChatWindow({ currentUser, selectedProfile }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchMessages();
    
    // Subscribe to new messages for REAL-TIME updates
    const subscription = supabase
      .channel(`chat-${currentUser.id}-${selectedProfile.user_id}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'direct_messages',
          filter: `or(and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedProfile.user_id}),and(sender_id.eq.${selectedProfile.user_id},receiver_id.eq.${currentUser.id}))`
        },
        (payload) => {
          console.log('New message received:', payload);
          const newMessage = payload.new as Message;
          setMessages(prev => {
            // Avoid duplicates
            const exists = prev.find(msg => msg.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    // Subscribe to typing status for REAL-TIME typing indicators
    const typingSubscription = supabase
      .channel(`typing-${currentUser.id}-${selectedProfile.user_id}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_status',
          filter: `and(user_id.eq.${selectedProfile.user_id},conversation_with.eq.${currentUser.id})`
        },
        (payload) => {
          console.log('Typing status changed:', payload);
          if (payload.new) {
            setIsTyping((payload.new as any).is_typing);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      typingSubscription.unsubscribe();
    };
  }, [selectedProfile.user_id, currentUser.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedProfile.user_id}),and(sender_id.eq.${selectedProfile.user_id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      // Encrypt message before sending
      const encryptedContent = encryptMessage(newMessage.trim());
      
      const { error } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: currentUser.id,
          receiver_id: selectedProfile.user_id,
          content: encryptedContent, // Store encrypted content
        });

      if (error) throw error;
      
      setNewMessage("");
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateTypingStatus = async (typing: boolean) => {
    try {
      await supabase
        .from('typing_status')
        .upsert({
          user_id: currentUser.id,
          conversation_with: selectedProfile.user_id,
          is_typing: typing,
        });
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      updateTypingStatus(false);
    }
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    updateTypingStatus(value.length > 0);
    
    // Clear typing status after 3 seconds of no typing
    setTimeout(() => {
      if (value === newMessage) {
        updateTypingStatus(false);
      }
    }, 3000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-chat-online';
      case 'away': return 'bg-chat-away';
      default: return 'bg-chat-offline';
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedProfile.avatar_url} />
                <AvatarFallback>{getInitials(selectedProfile.display_name || selectedProfile.username)}</AvatarFallback>
              </Avatar>
              <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(selectedProfile.status)} rounded-full border-2 border-card`}></div>
            </div>
            <div>
              <h3 className="font-semibold flex items-center space-x-2">
                <span>{selectedProfile.display_name || selectedProfile.username}</span>
                <Shield className="h-4 w-4 text-green-500" />
              </h3>
              <p className="text-sm text-muted-foreground">
                {selectedProfile.status === 'online' ? 'Online' : 'Last seen recently'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Video className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const isOwn = message.sender_id === currentUser.id;
              return (
                <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] ${isOwn ? 'order-1' : 'order-2'}`}>
                    <Card className={`p-3 ${
                      isOwn 
                        ? 'bg-chat-bubble-user text-primary-foreground ml-auto' 
                        : 'bg-chat-bubble-other'
                    }`}>
                      <p className="text-sm">{decryptMessage(message.content)}</p>
                      <p className={`text-xs mt-1 ${
                        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}>
                        {format(new Date(message.created_at), 'HH:mm')}
                      </p>
                    </Card>
                  </div>
                </div>
              );
            })
          )}
          
          {isTyping && (
            <div className="flex justify-start">
              <Card className="p-3 bg-chat-bubble-other">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-100"></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-200"></div>
                </div>
              </Card>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 border-t border-border bg-card/30">
        <div className="flex items-center space-x-2">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
            disabled={loading}
          />
          <Button 
            onClick={sendMessage} 
            disabled={loading || !newMessage.trim()}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}