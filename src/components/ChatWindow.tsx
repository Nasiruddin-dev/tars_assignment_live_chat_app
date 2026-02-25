// src/components/ChatWindow.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { Send, ArrowDown } from "lucide-react";

interface ChatWindowProps {
  conversationId: Id<"conversations">;
}

export default function ChatWindow({ conversationId }: ChatWindowProps) {
  const { user } = useUser();
  const [newMessage, setNewMessage] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [showUnreadBanner, setShowUnreadBanner] = useState(false);
  
  // NEW: Track the exact index where new messages start
  const [firstUnreadIndex, setFirstUnreadIndex] = useState<number | null>(null);
  const prevMessageCount = useRef<number | null>(null);

  const messages = useQuery(api.messages.get, { conversationId });
  const otherUser = useQuery(api.conversations.getChatDetails, { conversationId });
  const sendMessage = useMutation(api.messages.send);
  const markAsRead = useMutation(api.conversations.markAsRead);

  // Reset all states when you switch to a different user's chat
  useEffect(() => {
    setFirstUnreadIndex(null);
    prevMessageCount.current = null;
    setIsScrolledUp(false);
    setShowUnreadBanner(false);
    setNewMessage("");
  }, [conversationId]);

  // Handle Smart Scrolling and the New Message Divider
  useEffect(() => {
    if (!messages) return;

    if (prevMessageCount.current !== null && messages.length > prevMessageCount.current) {
      // A brand new message just arrived!
      const lastMsg = messages[messages.length - 1];
      const isMe = lastMsg.senderClerkId === user?.id;

      if (isScrolledUp && !isMe) {
        setShowUnreadBanner(true);
        // Mark the index of the first unread message so we can render the divider
        if (firstUnreadIndex === null) {
          setFirstUnreadIndex(prevMessageCount.current);
        }
      } else {
        // We are at the bottom, or I sent the message. Just scroll down.
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        if (!isMe) markAsRead({ conversationId });
        if (isMe) setFirstUnreadIndex(null); 
      }
    } else if (prevMessageCount.current === null) {
      // Initial load of the chat: force scroll to bottom immediately
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      }, 50);
      markAsRead({ conversationId });
    }

    prevMessageCount.current = messages.length;
  }, [messages?.length]); // We only want this to run when the message count changes

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    
    const isUp = scrollHeight - scrollTop - clientHeight > 100;
    setIsScrolledUp(isUp);

    // If they manually scroll back to the bottom
    if (!isUp && showUnreadBanner) {
      setShowUnreadBanner(false);
      markAsRead({ conversationId });
      // Remove the divider after 4 seconds of reading
      setTimeout(() => setFirstUnreadIndex(null), 4000);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowUnreadBanner(false);
    markAsRead({ conversationId });
    
    // Remove the divider 4 seconds after they click the banner
    setTimeout(() => setFirstUnreadIndex(null), 4000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const content = newMessage;
      setNewMessage("");
      await sendMessage({ conversationId, content });
      scrollToBottom();
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const formatTimestamp = (creationTime: number) => {
    const date = new Date(creationTime);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isThisYear = date.getFullYear() === now.getFullYear();

    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) return timeString;
    if (isThisYear) return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeString}`;
    return `${date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}, ${timeString}`;
  };

  if (messages === undefined) {
    return <div className="flex-1 flex items-center justify-center text-gray-500">Loading messages...</div>;
  }

  return (
    <div className="flex-1 flex flex-col bg-white h-screen relative">
      <div className="h-16 border-b px-6 flex items-center gap-3 bg-white shadow-sm z-20 relative">
        {otherUser ? (
          <>
            <img
              src={otherUser.imageUrl || `https://ui-avatars.com/api/?name=${otherUser.name}`}
              alt={otherUser.name || "User"}
              className="w-8 h-8 rounded-full object-cover"
            />
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">{otherUser.name}</h3>
            </div>
          </>
        ) : (
          <h3 className="font-semibold text-gray-800">Loading...</h3>
        )}
      </div>

      {showUnreadBanner && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30">
          <button 
            onClick={scrollToBottom}
            className="flex items-center gap-2 bg-blue-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium hover:bg-blue-700 transition-all animate-bounce"
          >
            <ArrowDown className="w-4 h-4" />
            New unread messages below
          </button>
        </div>
      )}

      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 bg-gray-50 relative"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-400 bg-white px-4 py-2 rounded-full shadow-sm text-sm border">
              No messages yet. Say hello! 👋
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderClerkId === user?.id;
            const showDivider = index === firstUnreadIndex;
            
            return (
              <div key={msg._id} className="flex flex-col">
                
                {/* THE NEW MESSAGES DIVIDER */}
                {showDivider && (
                  <div className="flex items-center justify-center my-6">
                    <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-4 py-1 rounded-full shadow-sm border border-blue-200">
                      New Messages Below
                    </span>
                  </div>
                )}

                {/* Message Bubble */}
                <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-4`}>
                  <div className="flex flex-col gap-1 max-w-[70%]">
                    <div 
                      className={`px-4 py-2.5 rounded-2xl ${
                        isMe 
                          ? "bg-blue-600 text-white rounded-br-sm" 
                          : "bg-white border text-gray-900 rounded-bl-sm shadow-sm"
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                    <span className={`text-[10px] text-gray-400 ${isMe ? "text-right pr-1" : "text-left pl-1"}`}>
                      {formatTimestamp(msg._creationTime)}
                    </span>
                  </div>
                </div>

              </div>
            );
          })
        )}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      <div className="p-4 bg-white border-t z-20">
        <form onSubmit={handleSend} className="flex gap-2 relative">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-100 border-transparent rounded-full pl-4 pr-12 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="absolute right-2 top-1.5 bottom-1.5 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}