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
          // ADD THIS LINE: Pass the Clerk ID to the frontend!
          senderClerkId: sender?.clerkId, 
        };
      })
    );

    return messagesWithSender;
  },
});