// src/components/Sidebar.tsx
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { UserButton } from "@clerk/nextjs";
import { Search, Loader2, MessageSquarePlus, X, Users } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";
import { ThemeToggle } from "./ThemeToggle"; // <-- NEW IMPORT

interface SidebarProps {
  onSelectConversation: (id: Id<"conversations">) => void;
}

export default function Sidebar({ onSelectConversation }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [now, setNow] = useState(Date.now());
  const [showModal, setShowModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Id<"users">[]>([]);
  const [groupName, setGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  const chats = useQuery(api.conversations.getSidebarChats);
  const allUsers = useQuery(api.users.getAllUsers);
  
  const getOrCreateConversation = useMutation(api.conversations.getOrCreate);
  const createGroup = useMutation(api.conversations.createGroup);

  const filteredChats = chats?.filter((chat) =>
    chat?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateChat = async () => {
    if (selectedUsers.length === 0) return;
    setIsCreating(true);
    try {
      if (selectedUsers.length === 1) {
        const convId = await getOrCreateConversation({ otherUserId: selectedUsers[0] });
        onSelectConversation(convId);
      } else {
        if (!groupName.trim()) {
          alert("Please enter a group name");
          setIsCreating(false);
          return;
        }
        const convId = await createGroup({ name: groupName, members: selectedUsers });
        onSelectConversation(convId);
      }
      setShowModal(false);
      setSelectedUsers([]);
      setGroupName("");
    } catch (error) {
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleUserSelection = (userId: Id<"users">) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  return (
    <div className="w-full h-full bg-gray-50 dark:bg-gray-900 border-r dark:border-gray-800 flex flex-col relative transition-colors">
      
      {/* HEADER WITH THEME TOGGLE */}
      <div className="p-4 border-b dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between transition-colors">
        <h2 className="font-semibold text-lg tracking-tight text-gray-900 dark:text-white">Chats</h2>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="p-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800 transition-colors">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search chats..."
            className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-transparent rounded-lg text-sm outline-none dark:text-white dark:placeholder-gray-400 transition-all focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative flex flex-col">
        {chats === undefined ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading chats...</p>
          </div>
        ) : chats.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
              <MessageSquarePlus className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-200">No chats yet</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Click the + button below to start a conversation.</p>
            </div>
          </div>
        ) : filteredChats?.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Search className="w-6 h-6 text-gray-400 dark:text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-200">No results found</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">We couldn't find any chats matching "{searchQuery}".</p>
            </div>
          </div>
        ) : (
          filteredChats?.map((chat) => (
            <div
              key={chat?._id}
              onClick={() => onSelectConversation(chat!._id)}
              className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors border-b dark:border-gray-800/50"
            >
              <div className="relative flex-shrink-0">
                <img src={chat?.imageUrl || ""} alt={chat?.name || ""} className="w-10 h-10 rounded-full object-cover" />
                {!chat?.isGroup && chat?.lastSeen !== undefined && chat.lastSeen > 0 && (now - chat.lastSeen < 5000) && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{chat?.name}</p>
                  {chat?.isGroup && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1 ml-2 flex-shrink-0">
                      <Users className="w-3 h-3" /> {chat.memberCount}
                    </span>
                  )}
                </div>
                {chat?.lastMessageContent && (
                  <p className={`text-xs truncate ${chat.unreadCount > 0 ? "text-gray-900 dark:text-white font-semibold" : "text-gray-500 dark:text-gray-400"}`}>
                    {chat.lastMessageContent}
                  </p>
                )}
              </div>
              {chat!.unreadCount > 0 && (
                <div className="bg-blue-600 dark:bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {chat?.unreadCount}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* FAB & MODALS... (Leaving unchanged structurally, adding dark classes) */}
      <button onClick={() => setShowModal(true)} className="absolute bottom-6 right-6 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 transition-all z-20">
        <MessageSquarePlus className="w-6 h-6" />
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh] border dark:border-gray-700">
            <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-lg dark:text-white">New Chat</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {selectedUsers.length > 1 && (
                <div className="mb-4">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Group Name</label>
                  <input type="text" placeholder="Enter group name..." value={groupName} onChange={(e) => setGroupName(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Select Users</p>
              <div className="space-y-2">
                {allUsers?.map(u => (
                  <label key={u._id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700" checked={selectedUsers.includes(u._id)} onChange={() => toggleUserSelection(u._id)} />
                    <img src={u.imageUrl || ""} alt={u.name} className="w-8 h-8 rounded-full" />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{u.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-4 border-t dark:border-gray-800 flex justify-end">
              <button disabled={selectedUsers.length === 0 || isCreating} onClick={handleCreateChat} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin"/> : "Start Chat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}