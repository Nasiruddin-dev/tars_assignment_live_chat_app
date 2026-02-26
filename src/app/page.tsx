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
      if (document.visibilityState === "visible") {
        updatePresence().catch(() => {});
      }
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

  // NATIVE MOBILE BACK BUTTON SUPPORT
  useEffect(() => {
    const handlePopState = () => {
      // If the user hits the browser/phone back button, clear the active chat
      setActiveConversationId(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSelectConversation = (id: Id<"conversations">) => {
    setActiveConversationId(id);
    // Push a state to the browser history so the back button knows what to do
    window.history.pushState({ chatOpen: true }, "");
  };

  return (
    <main className="flex h-screen w-full bg-white overflow-hidden">
      
      <SignedOut>
        <div className="flex w-full items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center justify-center gap-6 rounded-xl bg-white p-10 shadow-lg text-center mx-4">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Tars Live Chat</h1>
            <p className="text-gray-500 text-sm max-w-sm">
              Sign in to find other users and start messaging in real-time.
            </p>
            <SignInButton mode="modal">
              <button className="bg-black text-white px-6 py-2.5 rounded-md font-medium hover:bg-gray-800 transition-colors w-full">
                Sign In to Continue
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        {/* SIDEBAR: Hidden on mobile IF a chat is active */}
        <div className={`${activeConversationId ? "hidden md:flex" : "flex"} w-full md:w-80 h-full flex-shrink-0`}>
          <Sidebar onSelectConversation={handleSelectConversation} />
        </div>
        
        {/* CHAT WINDOW: Hidden on mobile IF NO chat is active */}
        <div className={`${activeConversationId ? "flex" : "hidden md:flex"} flex-1 h-full flex-col bg-gray-50/50 relative`}>
          {activeConversationId ? (
            <ChatWindow 
              conversationId={activeConversationId} 
              onBack={() => window.history.back()} // The UI back button triggers the browser back action!
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center space-y-3">
              <div>
                <h3 className="text-xl font-medium text-gray-700">Select a conversation</h3>
                <p className="text-sm text-gray-500">Choose a user from the sidebar to start chatting.</p>
              </div>
            </div>
          )}
        </div>
      </SignedIn>
      
    </main>
  );
}