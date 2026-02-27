// src/components/ChatWindow.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { Send, ArrowDown, Users, X, ArrowLeft, MessageSquare, Trash2, AlertCircle, RefreshCcw } from "lucide-react";

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
  const [selectedMessageId, setSelectedMessageId] = useState<Id<"messages"> | null>(null);
  const [lastTyped, setLastTyped] = useState(0);

  const [failedMessages, setFailedMessages] = useState<{ tempId: string; content: string }[]>([]);
  
  const updateTyping = useMutation(api.conversations.updateTyping);
  const typingMembers = useQuery(api.conversations.getTypingStatus, { conversationId }) || [];
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
  const toggleReaction = useMutation(api.messages.toggleReaction);

  useEffect(() => {
    setFirstUnreadIndex(null);
    prevMessageCount.current = null;
    setIsScrolledUp(false);
    setShowUnreadBanner(false);
    setShowGroupInfo(false);
    setNewMessage("");
    setSelectedMessageId(null);
    setFailedMessages([]);
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

  const sendOrRetry = async (content: string, tempId?: string) => {
    const id = tempId || Date.now().toString();
    
    // OVERRIDE: Convex caches offline mutations. To meet the assignment's explicit "retry" UI requirement,
    // we manually check for offline status and force the failure state.
    if (!navigator.onLine) {
      setFailedMessages((prev) => {
        const filtered = prev.filter((m) => m.tempId !== id);
        return [...filtered, { tempId: id, content }];
      });
      setTimeout(() => scrollToBottom(), 100);
      return;
    }

    try {
      setFailedMessages((prev) => prev.filter((m) => m.tempId !== id));
      await sendMessage({ conversationId, content });
      scrollToBottom();
    } catch (error) {
      console.error("Message failed to send:", error);
      setFailedMessages((prev) => [...prev, { tempId: id, content }]);
      setTimeout(() => scrollToBottom(), 100);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const content = newMessage;
    setNewMessage("");
    await sendOrRetry(content);
  };

  // FORMATTERS FOR WHATSAPP STYLE DATES
  const formatTime = (creationTime: number) => {
    return new Date(creationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateGroup = (creationTime: number) => {
    const date = new Date(creationTime);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    if (date.toDateString() === now.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric';
    return date.toLocaleDateString([], options);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 h-full relative overflow-hidden w-full transition-colors">
      
      {/* HEADER */}
      <div className="h-16 border-b dark:border-gray-800 px-4 md:px-6 flex items-center justify-between bg-white dark:bg-gray-900 shadow-sm z-20 relative transition-colors">
        {chatDetails ? (
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={onBack} className="md:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            
            <div 
              className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded-lg transition-colors"
              onClick={() => chatDetails.isGroup && setShowGroupInfo(true)}
            >
              <img src={chatDetails.imageUrl || ""} alt={chatDetails.name || "User"} className="w-9 h-9 rounded-full object-cover" />
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm flex items-center gap-2">
                  {chatDetails.name}
                  {chatDetails.isGroup && <Users className="w-3 h-3 text-gray-400 dark:text-gray-500" />}
                </h3>
                {!chatDetails.isGroup && chatDetails.lastSeen !== undefined && chatDetails.lastSeen > 0 && (now - chatDetails.lastSeen < 5000) ? (
                  <p className="text-[10px] text-green-500 font-medium">Online</p>
                ) : chatDetails.isGroup ? (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">{chatDetails.members?.length} members</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 ml-2">
             <div className="w-9 h-9 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse"></div>
             <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24 animate-pulse"></div>
          </div>
        )}
      </div>

      {showUnreadBanner && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30">
          <button onClick={scrollToBottom} className="flex items-center gap-2 bg-blue-600/90 dark:bg-blue-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-full shadow-lg text-sm hover:bg-blue-700 dark:hover:bg-blue-600 animate-bounce">
            <ArrowDown className="w-4 h-4" /> New unread messages below
          </button>
        </div>
      )}

      {showGroupInfo && chatDetails?.isGroup && (
        <div className="absolute top-16 left-0 sm:left-auto sm:right-6 w-full sm:w-72 bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-xl z-40 flex flex-col sm:rounded-b-xl max-h-64 sm:max-h-96 animate-in slide-in-from-top-2">
          <div className="p-3 border-b dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 sm:rounded-t-none">
            <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">Group Members ({chatDetails.members?.length})</h3>
            <button onClick={() => setShowGroupInfo(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full transition-colors">
              <X className="w-4 h-4"/>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {chatDetails.members?.map((member: any) => (
              <div key={member._id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <img src={member.imageUrl} alt={member.name} className="w-8 h-8 rounded-full" />
                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium truncate">{member.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MESSAGE AREA */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-900 relative transition-colors">
        
        {messages === undefined ? (
          <div className="flex-1 overflow-y-auto space-y-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <div className={`w-2/3 md:w-1/2 h-12 rounded-2xl animate-pulse ${i % 2 === 0 ? "bg-blue-100 dark:bg-blue-900/40 rounded-br-sm" : "bg-gray-200 dark:bg-gray-800 rounded-bl-sm"}`}></div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
            <div className="w-16 h-16 bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm rounded-full flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-blue-500 dark:text-blue-400" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">It's quiet in here...</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Send a message to start the conversation.</p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderClerkId === user?.id;
            const showDivider = index === firstUnreadIndex;
            const showSenderName = chatDetails?.isGroup && !isMe;
            
            // WHATSAPP STYLE DATE LOGIC
            const currentDateString = new Date(msg._creationTime).toDateString();
            const prevDateString = index > 0 ? new Date(messages[index - 1]._creationTime).toDateString() : null;
            const showDateHeader = currentDateString !== prevDateString;
            
            return (
              <div key={msg._id} className="flex flex-col">
                
                {/* DATE GROUP HEADER */}
                {showDateHeader && (
                  <div className="flex justify-center my-4">
                    <span className="bg-gray-200/80 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[11px] font-medium px-3 py-1 rounded-full shadow-sm backdrop-blur-sm">
                      {formatDateGroup(msg._creationTime)}
                    </span>
                  </div>
                )}

                {/* NEW MESSAGES DIVIDER */}
                {showDivider && (
                  <div className="flex items-center justify-center mb-4">
                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-semibold px-4 py-1 rounded-full shadow-sm border border-blue-200 dark:border-blue-800">New Messages Below</span>
                  </div>
                )}

                <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-4`}>
                  
                  <div className={`flex flex-col gap-1 max-w-[85%] md:max-w-[70%] relative ${isMe ? "items-end" : "items-start"}`}>
                    {showSenderName && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium ml-1">
                        {msg.senderName}
                      </span>
                    )}

                    {selectedMessageId === msg._id && !msg.isDeleted && (
                      <div className={`absolute z-30 -top-10 flex gap-1 bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-md rounded-full px-2 py-1 ${isMe ? "right-0" : "left-0"}`}>
                        {["👍", "❤", "😂", "😮", "😢"].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleReaction({ messageId: msg._id, emoji });
                              setSelectedMessageId(null);
                            }}
                            className="hover:scale-125 transition-transform px-1.5 py-0.5 text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <div 
                      onClick={() => {
                        if (!msg.isDeleted) setSelectedMessageId(selectedMessageId === msg._id ? null : msg._id);
                      }}
                      className={`px-4 py-2.5 w-fit max-w-full shadow-sm transition-all ${!msg.isDeleted ? "cursor-pointer" : ""} ${
                        msg.isDeleted 
                          ? "bg-transparent border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 italic rounded-2xl" 
                          : isMe 
                            ? "bg-blue-600 text-white rounded-2xl rounded-br-sm" 
                            : "bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-2xl rounded-bl-sm" 
                      }`}
                    >
                      {msg.isDeleted ? (
                        <p className="text-sm flex items-center gap-1">This message was deleted</p>
                      ) : (
                        <p className="text-sm leading-relaxed break-words break-all whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>

                    {!msg.isDeleted && msg.reactions && msg.reactions.length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
                        {Object.entries(
                          msg.reactions.reduce((acc, curr) => {
                            acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>)
                        ).map(([emoji, count]) => {
                          const iReacted = msg.reactions?.some(r => r.clerkId === user?.id && r.emoji === emoji);
                          return (
                            <div 
                              key={emoji} 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleReaction({ messageId: msg._id, emoji });
                              }}
                              className={`cursor-pointer text-[10px] px-1.5 py-0.5 rounded-full border flex items-center gap-1 transition-colors ${
                                iReacted ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="font-medium">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className={`flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 ${isMe ? "justify-end pr-1" : "justify-start pl-1"}`}>
                      {/* ONLY RENDERING THE TIME HERE NOW */}
                      <span>{formatTime(msg._creationTime)}</span>
                      
                      {selectedMessageId === msg._id && isMe && !msg.isDeleted && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMessage({ messageId: msg._id });
                            setSelectedMessageId(null);
                          }}
                          className="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded p-1 transition-colors"
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

        {failedMessages.map((msg) => (
          <div key={msg.tempId} className="flex justify-end mb-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex flex-col gap-1 max-w-[85%] md:max-w-[70%] items-end">
              
              <div className="px-4 py-2.5 w-fit max-w-full shadow-sm transition-all bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-900 dark:text-red-200 rounded-2xl rounded-br-sm">
                <p className="text-sm leading-relaxed break-words break-all whitespace-pre-wrap">{msg.content}</p>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-red-500 dark:text-red-400 pr-1 mt-0.5">
                <AlertCircle className="w-3 h-3" />
                <span>Failed to send</span>
                <button 
                  onClick={() => sendOrRetry(msg.content, msg.tempId)}
                  className="flex items-center gap-1 font-semibold hover:underline bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded ml-1 transition-colors"
                >
                  <RefreshCcw className="w-2.5 h-2.5" /> Retry
                </button>
              </div>

            </div>
          </div>
        ))}

        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* FOOTER & INPUT AREA */}
      <div className="p-3 md:p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800 z-20 relative transition-colors">
        
        {activeTypers.length > 0 && (
          <div className="absolute -top-8 left-6 flex items-center gap-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-3 py-1.5 rounded-t-lg border dark:border-gray-700 border-b-0 text-xs text-gray-500 dark:text-gray-400 shadow-sm transition-all">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
              <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
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
              if (now - lastTyped > 1500) {
                setLastTyped(now);
                updateTyping({ conversationId }).catch(() => {});
              }
            }} 
            placeholder="Type a message..." 
            className="flex-1 bg-gray-100 dark:bg-gray-800 border-transparent rounded-full pl-4 pr-12 py-3 text-sm outline-none text-gray-900 dark:text-white dark:placeholder-gray-400 transition-all focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500" 
          />
          <button type="submit" disabled={!newMessage.trim()} className="absolute right-2 top-1.5 bottom-1.5 p-2 bg-blue-600 dark:bg-blue-500 text-white rounded-full hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}