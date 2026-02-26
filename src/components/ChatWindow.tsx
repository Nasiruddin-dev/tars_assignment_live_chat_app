// src/components/ChatWindow.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { Send, ArrowDown, Users, X, ArrowLeft, MessageSquare, Trash2 } from "lucide-react";

interface ChatWindowProps {
  conversationId: Id<"conversations">;
  onBack: () => void;
}

export default function ChatWindow({ conversationId, onBack }: ChatWindowProps) {
  const { user } = useUser();
  const [newMessage, setNewMessage] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [showUnreadBanner, setShowUnreadBanner] = useState(false);
  
  const [firstUnreadIndex, setFirstUnreadIndex] = useState<number | null>(null);
  const prevMessageCount = useRef<number | null>(null);

  const [now, setNow] = useState(Date.now());
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  // Track which message is tapped to show the delete button
  const [selectedMessageId, setSelectedMessageId] = useState<Id<"messages"> | null>(null);

  const [lastTyped, setLastTyped] = useState(0);
  const updateTyping = useMutation(api.conversations.updateTyping);
  const typingMembers = useQuery(api.conversations.getTypingStatus, { conversationId }) || [];
  
  // Only consider them "typing" if their last keystroke was less than 2 seconds ago
  const activeTypers = typingMembers.filter((t) => now - t.typingAt < 2000);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const messages = useQuery(api.messages.get, { conversationId });
  const chatDetails = useQuery(api.conversations.getChatDetails, { conversationId });
  const sendMessage = useMutation(api.messages.send);
  const markAsRead = useMutation(api.conversations.markAsRead);
  const deleteMessage = useMutation(api.messages.deleteMessage);

  useEffect(() => {
    setFirstUnreadIndex(null);
    prevMessageCount.current = null;
    setIsScrolledUp(false);
    setShowUnreadBanner(false);
    setShowGroupInfo(false);
    setNewMessage("");
    setSelectedMessageId(null);
  }, [conversationId]);

  useEffect(() => {
    if (!messages) return;

    if (prevMessageCount.current !== null && messages.length > prevMessageCount.current) {
      const lastMsg = messages[messages.length - 1];
      const isMe = lastMsg.senderClerkId === user?.id;

      if (isScrolledUp && !isMe) {
        setShowUnreadBanner(true);
        if (firstUnreadIndex === null) setFirstUnreadIndex(prevMessageCount.current);
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        if (!isMe) markAsRead({ conversationId });
        if (isMe) setFirstUnreadIndex(null); 
      }
    } else if (prevMessageCount.current === null) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "instant" }), 50);
      markAsRead({ conversationId });
    }

    prevMessageCount.current = messages.length;
  }, [messages?.length]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 100;
    setIsScrolledUp(isUp);

    if (!isUp && showUnreadBanner) {
      setShowUnreadBanner(false);
      markAsRead({ conversationId });
      setTimeout(() => setFirstUnreadIndex(null), 4000);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowUnreadBanner(false);
    markAsRead({ conversationId });
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
      console.error(error);
    }
  };

  const formatTimestamp = (creationTime: number) => {
    const date = new Date(creationTime);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (date.toDateString() === new Date().toDateString()) return timeString;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeString}`;
  };

  if (messages === undefined) {
    return <div className="flex-1 flex items-center justify-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="flex-1 flex flex-col bg-white h-full relative overflow-hidden w-full">
      
      {/* HEADER */}
      <div className="h-16 border-b px-4 md:px-6 flex items-center justify-between bg-white shadow-sm z-20 relative">
        {chatDetails ? (
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={onBack} className="md:hidden p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            
            <div 
              className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
              onClick={() => chatDetails.isGroup && setShowGroupInfo(true)}
            >
              <img src={chatDetails.imageUrl || ""} alt={chatDetails.name || "User"} className="w-9 h-9 rounded-full object-cover" />
              <div>
                <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                  {chatDetails.name}
                  {chatDetails.isGroup && <Users className="w-3 h-3 text-gray-400" />}
                </h3>
                {!chatDetails.isGroup && chatDetails.lastSeen !== undefined && chatDetails.lastSeen > 0 && (now - chatDetails.lastSeen < 5000) ? (
                  <p className="text-[10px] text-green-500 font-medium">Online</p>
                ) : chatDetails.isGroup ? (
                  <p className="text-[10px] text-gray-400">{chatDetails.members?.length} members</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <h3 className="font-semibold text-gray-800 ml-4">Loading...</h3>
        )}
      </div>

      {showUnreadBanner && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30">
          <button onClick={scrollToBottom} className="flex items-center gap-2 bg-blue-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-full shadow-lg text-sm hover:bg-blue-700 animate-bounce">
            <ArrowDown className="w-4 h-4" /> New unread messages below
          </button>
        </div>
      )}

      {showGroupInfo && chatDetails?.isGroup && (
        <div className="absolute top-16 left-0 sm:left-auto sm:right-6 w-full sm:w-72 bg-white border shadow-xl z-40 flex flex-col sm:rounded-b-xl max-h-64 sm:max-h-96 animate-in slide-in-from-top-2">
          <div className="p-3 border-b flex items-center justify-between bg-gray-50 sm:rounded-t-none">
            <h3 className="font-semibold text-sm text-gray-800">Group Members ({chatDetails.members?.length})</h3>
            <button onClick={() => setShowGroupInfo(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
              <X className="w-4 h-4"/>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {chatDetails.members?.map((member: any) => (
              <div key={member._id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                <img src={member.imageUrl} alt={member.name} className="w-8 h-8 rounded-full" />
                <p className="text-sm text-gray-700 font-medium truncate">{member.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 relative">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
            <div className="w-16 h-16 bg-white border shadow-sm rounded-full flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-blue-500" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-medium text-gray-900">It's quiet in here...</h3>
              <p className="text-sm text-gray-500 mt-1">Send a message to start the conversation.</p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderClerkId === user?.id;
            const showDivider = index === firstUnreadIndex;
            const showSenderName = chatDetails?.isGroup && !isMe;
            
            return (
              <div key={msg._id} className="flex flex-col">
                {showDivider && (
                  <div className="flex items-center justify-center my-6">
                    <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-4 py-1 rounded-full shadow-sm border border-blue-200">New Messages Below</span>
                  </div>
                )}

                <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-4`}>
                  
                  <div className={`flex flex-col gap-1 max-w-[85%] md:max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>
                    {showSenderName && (
                      <span className="text-[10px] text-gray-500 font-medium ml-1">
                        {msg.senderName}
                      </span>
                    )}
                    
                    {/* MESSAGE BUBBLE (Now Clickable) */}
                    <div 
                      onClick={() => {
                        // Only allow tapping our own messages that aren't already deleted
                        if (isMe && !msg.isDeleted) {
                          setSelectedMessageId(selectedMessageId === msg._id ? null : msg._id);
                        }
                      }}
                      className={`px-4 py-2.5 w-fit max-w-full shadow-sm transition-all ${isMe && !msg.isDeleted ? "cursor-pointer" : ""} ${
                        msg.isDeleted 
                          ? "bg-transparent border border-gray-300 text-gray-500 italic rounded-2xl" 
                          : isMe 
                            ? "bg-blue-600 text-white rounded-2xl rounded-br-sm" 
                            : "bg-white border text-gray-900 rounded-2xl rounded-bl-sm" 
                      }`}
                    >
                      {msg.isDeleted ? (
                        <p className="text-sm flex items-center gap-1">
                          This message was deleted
                        </p>
                      ) : (
                        <p className="text-sm leading-relaxed break-words break-all whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>

                    {/* TIMESTAMP & INSTANT DELETE BUTTON */}
                    <div className={`flex items-center gap-2 text-[10px] text-gray-400 ${isMe ? "justify-end pr-1" : "justify-start pl-1"}`}>
                      <span>{formatTimestamp(msg._creationTime)}</span>
                      
                      {/* Only show trash icon if THIS specific message is tapped! */}
                      {selectedMessageId === msg._id && isMe && !msg.isDeleted && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation(); // Prevents the bubble's onClick from firing
                            deleteMessage({ messageId: msg._id });
                            setSelectedMessageId(null); // Hide icon immediately after click
                          }}
                          className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded p-1 transition-colors"
                          title="Delete message"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* FOOTER & INPUT AREA */}
      <div className="p-3 md:p-4 bg-white border-t z-20 relative">
        
        {/* ANIMATED TYPING INDICATOR */}
        {activeTypers.length > 0 && (
          <div className="absolute -top-8 left-6 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-t-lg border border-b-0 text-xs text-gray-500 shadow-sm transition-all">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
            </div>
            <span className="font-medium">
              {chatDetails?.isGroup ? `${activeTypers[0].name} is typing...` : "typing..."}
            </span>
          </div>
        )}

        <form onSubmit={handleSend} className="flex gap-2 relative">
          <input 
            type="text" 
            value={newMessage} 
            onChange={(e) => {
              setNewMessage(e.target.value);
              // Send a typing ping to the server, but only once every 1.5 seconds to save database bandwidth!
              if (now - lastTyped > 1500) {
                setLastTyped(now);
                updateTyping({ conversationId }).catch(() => {});
              }
            }} 
            placeholder="Type a message..." 
            className="flex-1 bg-gray-100 border-transparent rounded-full pl-4 pr-12 py-3 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-blue-500" 
          />
          <button type="submit" disabled={!newMessage.trim()} className="absolute right-2 top-1.5 bottom-1.5 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}