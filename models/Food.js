import mongoose from "mongoose";

const FoodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    desc: {
      type: String,
      required: true,
    },
    img: {
      type: String,
      default: null,
    },
    price: {
      type: {
        org: { type: Number, default: 0.0 },
        mrp: { type: Number, default: 0.0 },
      },
      default: { org: 0.0, mrp: 0.0 },
    },
    category: {
      type: [String],
      default: [],
    },
    //nguyen lieu 
    ingredients: {
      type: [String],
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Food", FoodSchema);
