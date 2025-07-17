import mongoose from "mongoose";
const { Schema } = mongoose;

const newsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: String, required: true }, // ganti penulis → author
    image: { type: String, required: true },
    imagePublicId: { type: String, required: false },
  },
  { timestamps: true }
);

const News = mongoose.model("News", newsSchema);
export default News;
