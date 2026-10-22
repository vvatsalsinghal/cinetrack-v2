import mongoose from "mongoose";
import { connectToDatabase } from "./database.js";
import { CinemaEntry } from "./models/CinemaEntry.js";
import { Friendship } from "./models/Friendship.js";
import { User } from "./models/User.js";

try {
  await connectToDatabase();
  await Promise.all([User.init(), CinemaEntry.init(), Friendship.init()]);
  await mongoose.connection.db.admin().ping();
  console.log("MongoDB connection and CineTrack indexes are ready.");
} finally {
  await mongoose.disconnect();
}
