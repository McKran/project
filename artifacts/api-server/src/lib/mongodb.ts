import mongoose from "mongoose";

let connected = false;

export async function connectMongo(): Promise<void> {
  if (connected) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri, { dbName: "agriassist" });
  connected = true;
}

const conversationSchema = new mongoose.Schema({
  title: { type: String, default: "New Chat" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Conversation = mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);
export const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
