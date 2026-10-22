import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
      maxlength: 255,
    },
    handle: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_]{3,30}$/,
    },
    displayName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 50,
    },
    collectionPrivacy: {
      type: String,
      enum: ["private", "friends", "public"],
      default: "private",
    },
  },
  { timestamps: true },
);

export const User =
  mongoose.models.User ?? mongoose.model("User", userSchema);
