import mongoose from "mongoose";

const cinemaEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tmdbId: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    posterUrl: {
      type: String,
      default: null,
      match:
        /^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i,
    },
    releaseYear: {
      type: String,
      default: null,
      match: /^\d{4}$/,
    },
    status: {
      type: String,
      enum: ["saved", "watching", "finished"],
      default: "saved",
      required: true,
    },
    rating: {
      type: Number,
      default: null,
      min: 1,
      max: 5,
      validate: (value) => value === null || Number.isInteger(value),
    },
    review: {
      type: String,
      default: "",
      maxlength: 500,
    },
  },
  { timestamps: true },
);

cinemaEntrySchema.index({ userId: 1, tmdbId: 1 }, { unique: true });

export const CinemaEntry =
  mongoose.models.CinemaEntry ??
  mongoose.model("CinemaEntry", cinemaEntrySchema);
