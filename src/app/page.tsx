// src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import { Id } from "../../convex/_generated/dataModel";

export default function Home() {
  const [activeConversationId, setActiveConversationId] = useState<Id<"conversations"> | null>(null);
  const updatePresence = useMutation(api.users.updatePresence);

  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === "visible") updatePresence().catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 2000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [updatePresence]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.chatOpen) return;
      
      setActiveConversationId(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSelectConversation = (id: Id<"conversations">) => {
    setActiveConversationId(id);
    window.history.pushState({ chatOpen: true }, "");
  };

  return (
    // CHANGED: h-screen is now h-[100dvh] to fix mobile address bar shifting
    <main className="flex h-[100dvh] w-full bg-white dark:bg-gray-900 overflow-hidden transition-colors">
      
      <SignedOut>
        <div className="flex w-full items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
          <div className="flex flex-col items-center justify-center gap-6 rounded-xl bg-white dark:bg-gray-800 p-10 shadow-lg text-center mx-4 border dark:border-gray-700 transition-colors">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Tars Live Chat</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm">
              Sign in to find other users and start messaging in real-time.
            </p>
            <SignInButton mode="modal">
              <button className="bg-black dark:bg-white text-white dark:text-black px-6 py-2.5 rounded-md font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors w-full">
                Sign In to Continue
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className={`${activeConversationId ? "hidden md:flex" : "flex"} w-full md:w-80 h-full flex-shrink-0 border-r dark:border-gray-800`}>
          <Sidebar onSelectConversation={handleSelectConversation} />
        </div>
        
        <div className={`${activeConversationId ? "flex" : "hidden md:flex"} flex-1 h-full flex-col bg-gray-50/50 dark:bg-gray-900 relative transition-colors`}>
          {activeConversationId ? (
            <ChatWindow conversationId={activeConversationId} onBack={() => window.history.back()} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center space-y-3 bg-gray-50 dark:bg-gray-900 transition-colors">
              <div>
                <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300">Select a conversation</h3>
                <p className="text-sm text-gray-500 dark:text-gray-500">Choose a user from the sidebar to start chatting.</p>
              </div>
            </div>
          )}
        </div>
      </SignedIn>
      
    </main>
  );
}