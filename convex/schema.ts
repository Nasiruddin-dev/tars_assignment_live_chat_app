// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    clerkId: v.string(),
    isOnline: v.boolean(),
    lastSeen: v.optional(v.number()),
  }).index("by_clerkId", ["clerkId"]),

  conversations: defineTable({
    isGroup: v.boolean(), // Makes it easy to implement the optional group chat
    name: v.optional(v.string()), // Used only if it's a group chat
    lastMessageId: v.optional(v.id("messages")), // Helps populate the sidebar quickly
  }),

  conversationMembers: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    unreadCount: v.number(),
    typingAt: v.optional(v.number()), 
  })
    .index("by_conversationId", ["conversationId"])
    .index("by_userId", ["userId"])
    .index("by_userId_and_conversationId", ["userId", "conversationId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    content: v.string(),
    isDeleted: v.boolean(), 
  }).index("by_conversationId", ["conversationId"]),
});