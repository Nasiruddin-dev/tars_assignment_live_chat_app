// src/app/page.tsx
"use client";

import { useState } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow"; // Import the new component
import { Id } from "../../convex/_generated/dataModel";

export default function Home() {
  const [activeConversationId, setActiveConversationId] = useState<Id<"conversations"> | null>(null);

  return (
    <main className="flex h-screen w-full bg-white overflow-hidden">
      
      <SignedOut>
        <div className="flex w-full items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center justify-center gap-6 rounded-xl bg-white p-10 shadow-lg text-center">
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
        <Sidebar onSelectConversation={setActiveConversationId} />
        
        <div className="flex-1 flex flex-col bg-gray-50/50 relative">
          {activeConversationId ? (
            // Render the Chat Window when a user is selected!
            <ChatWindow conversationId={activeConversationId} />
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