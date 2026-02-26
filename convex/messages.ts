// convex/messages.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) throw new Error("User not found");

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: me._id,
      content: args.content,
      isDeleted: false,
    });

    await ctx.db.patch(args.conversationId, {
      lastMessageId: messageId,
    });

    // INCREMENT UNREAD COUNT FOR THE RECIPIENT
    const members = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    for (const member of members) {
      if (member.userId !== me._id) {
        await ctx.db.patch(member._id, {
          unreadCount: (member.unreadCount || 0) + 1,
        });
      }
    }

    return messageId;
  },
});

export const get = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .collect();
      
    const messagesWithSender = await Promise.all(
      messages.map(async (message) => {
        const sender = await ctx.db.get(message.senderId);
        return {
          ...message,
          senderName: sender?.name,
          senderImage: sender?.imageUrl,
          senderClerkId: sender?.clerkId, 
        };
      })
    );

    return messagesWithSender;
  },
});

export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) throw new Error("User not found");

    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");

    // Security check: Only the sender can delete their message
    if (msg.senderId !== me._id) {
      throw new Error("You can only delete your own messages");
    }

    // Soft delete: We patch the record, but we do NOT remove it from the database
    await ctx.db.patch(args.messageId, {
      isDeleted: true,
    });
  },
});

export const toggleReaction = mutation({
  args: { 
    messageId: v.id("messages"), 
    emoji: v.string() 
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");

    // Grab existing reactions or start with an empty array
    let reactions = msg.reactions || [];
    
    // Check if this user already reacted to this message
    const existingIndex = reactions.findIndex(r => r.clerkId === identity.subject);

    if (existingIndex !== -1) {
      if (reactions[existingIndex].emoji === args.emoji) {
        // 1. They clicked the SAME emoji: Remove it
        reactions.splice(existingIndex, 1);
      } else {
        // 2. They clicked a DIFFERENT emoji: Swap it
        reactions[existingIndex].emoji = args.emoji;
      }
    } else {
      // 3. They haven't reacted yet: Add it
      reactions.push({ clerkId: identity.subject, emoji: args.emoji });
    }

    // Save the updated array to the database
    await ctx.db.patch(args.messageId, { reactions });
  },
});