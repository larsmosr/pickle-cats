import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const checkPassword = mutation({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    const correctPassword = process.env.APP_PASSWORD;
    if (!correctPassword) {
      throw new Error("APP_PASSWORD environment variable not set");
    }
    if (args.password !== correctPassword) {
      return { success: false, token: null };
    }
    // Generate a simple session token
    const token = crypto.randomUUID();
    return { success: true, token };
  },
});
