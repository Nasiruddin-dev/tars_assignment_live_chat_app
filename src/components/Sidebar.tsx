// src/components/Sidebar.tsx
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { UserButton } from "@clerk/nextjs";
import { Search, Loader2 } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";

// 1. Define the props we are receiving from page.tsx
interface SidebarProps {
  onSelectConversation: (id: Id<"conversations">) => void;
}

export default function Sidebar({ onSelectConversation }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isStartingChat, setIsStartingChat] = useState(false);
  
  // NEW: Add a ticking 'now' state to force UI updates for the green dots
  const [now, setNow] = useState(Date.now());

  // Make the UI re-evaluate the green dots every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  // 2. Fetch users and grab our new mutation
  const users = useQuery(api.users.getUsers);
  const getOrCreateConversation = useMutation(api.conversations.getOrCreate);

  const filteredUsers = users?.filter((user) =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 3. The click handler for when you click a user's name
  const handleStartChat = async (otherUserId: Id<"users">) => {
    try {
      setIsStartingChat(true);
      // Call the Convex backend to get or create the chat
      const conversationId = await getOrCreateConversation({ otherUserId });
      // Pass the resulting ID back to the parent page.tsx
      onSelectConversation(conversationId);
    } catch (error) {
      console.error("Failed to start chat:", error);
    } finally {
      setIsStartingChat(false);
    }
  };

  return (
    <div className="w-80 h-screen bg-gray-50 border-r flex flex-col">
      <div className="p-4 border-b bg-white flex items-center justify-between">
        <h2 className="font-semibold text-lg tracking-tight">Chats</h2>
        <UserButton afterSignOutUrl="/" />
      </div>

      <div className="p-4 bg-white border-b">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            className="w-full pl-9 pr-4 py-2 bg-gray-100 border-transparent rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        {/* Loading overlay if we are waiting for the database to create a chat */}
        {isStartingChat && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        )}

        {users === undefined || users === null ? (
          <p className="p-4 text-center text-sm text-gray-500">Loading users...</p>
        ) : filteredUsers?.length === 0 ? (
          <p className="p-4 text-center text-sm text-gray-500">No users found.</p>
        ) : (
          filteredUsers?.map((user) => (
            <div
              key={user._id}
              onClick={() => handleStartChat(user._id)}
              className="flex items-center gap-3 p-3 hover:bg-gray-100 cursor-pointer transition-colors border-b border-gray-50"
            >
              <div className="relative flex-shrink-0">
                <img
                  src={user.imageUrl || "https://ui-avatars.com/api/?name=" + user.name}
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                {/* Calculate real-time presence using 'now' */}
                {user.lastSeen && (now - user.lastSeen < 5000) && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                {/* Display the latest message preview */}
                {user.lastMessageContent && (
                  <p className={`text-xs truncate ${user.unreadCount > 0 ? "text-gray-900 font-semibold" : "text-gray-500"}`}>
                    {user.lastMessageContent}
                  </p>
                )}
              </div>
              {/* UNREAD BADGE */}
              {user.unreadCount > 0 && (
                <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {user.unreadCount}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}