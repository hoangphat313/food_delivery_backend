import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { createError } from "../error.js";
import User from "../models/User.js";
import Orders from "../models/Orders.js";
import Food from "../models/Food.js"
import mongoose from "mongoose";
dotenv.config();

// Auth

export const UserRegister = async (req, res, next) => {
  try {
    const { email, password, name, img } = req.body;

    //Check for existing user
    const existingUser = await User.findOne({ email }).exec();
    if (existingUser) {
      return next(createError(409, "Email is already in use."));
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      img,
    });
    const createdUser = await user.save();
    const token = jwt.sign({ id: createdUser._id }, process.env.JWT, {
      expiresIn: "9999 years",
    });
    return res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
};

export const UserLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    //Check for existing user
    const user = await User.findOne({ email: email }).exec();
    if (!user) {
      return next(createError(409, "User not found."));
    }

    const isPasswordCorrect = await bcrypt.compareSync(password, user.password);
    if (!isPasswordCorrect) {
      return next(createError(403, "Incorrect password"));
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT, {
      expiresIn: "9999 years",
    });
    return res.status(200).json({ token, user });
  } catch (err) {
    next(err);
  }
};

//Cart

export const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const userJWT = req.user;
    const user = await User.findById(userJWT.id);

    // Check if user and user.cart exist
    if (!user || !user.cart) {
      return res.status(404).json({ message: 'User not found or cart not initialized' });
    }

    // Find the index of the existing cart item
    let existingCartItemIndex = -1;
    for (let i = 0; i < user.cart.length; i++) {
      if (user.cart[i].product && user.cart[i].product.toString() === productId) {
        existingCartItemIndex = i;
        break;
      }
    }

    if (existingCartItemIndex !== -1) {
      // Product is already in the cart, update the quantity
      user.cart[existingCartItemIndex].quantity += quantity;
    } else {
      // Product is not in the cart, add it
      user.cart.push({ product: productId, quantity });
    }

    await user.save();
    return res.status(200).json({ message: 'Product added to cart successfully', user });
  } catch (err) {
    console.error('Error adding to cart:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const removeFromCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const userJWT = req.user;
    const user = await User.findById(userJWT.id);
    if (!user) {
      return next(createError(404, "User not found"));
    }
    const productIndex = user.cart.findIndex((item) =>
      item.product.equals(productId)
    );
    if (productIndex !== -1) {
      if (quantity && quantity > 0) {
        user.cart[productIndex].quantity -= quantity;
        if (user.cart[productIndex].quantity <= 0) {
          user.cart.splice(productIndex, 1); // Remove the product from the cart
        }
      } else {
        user.cart.splice(productIndex, 1);
      }

      await user.save();

      return res
        .status(200)
        .json({ message: "Product quantity updated in cart", user });
    } else {
      return next(createError(404, "Product not found in the user's cart"));
    }
  } catch (err) {
    next(err);
  }
};

export const getAllCartItems = async (req, res, next) => {
  try {
    const userJWT = req.user;
    const user = await User.findById(userJWT.id).populate({
      path: "cart.product",
      model: "Food",
    });
    const cartItems = user.cart;
    return res.status(200).json(cartItems);
  } catch (err) {
    next(err);
  }
};

//Orders

export const placeOrder = async (req, res, next) => {
  try {
    const { products, address, totalAmount } = req.body;
    const userJWT = req.user;
    const user = await User.findById(userJWT.id);

    const order = new Orders({
      products,
      user: user._id,
      total_amount: totalAmount,
      address,
    });

    await order.save();
    user.cart = [];
    await user.save();
    return res
      .status(200)
      .json({ message: "Order placed successfully", order });
  } catch (err) {
    next(err);
  }
};

export const getAllOrders = async (req, res, next) => {
  try {
    const userJWT = req.user;
    const user = await User.findById(userJWT.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const orders = await Orders.find({ user: user._id }).populate('products.product');
    return res.status(200).json(orders);
  } catch (err) {
    next(err);
  }
};

//Favorites

export const removeFromFavorites = async (req, res, next) => {
  try {
    const { productId } = req.body;
    const userJWT = req.user;
    const user = await User.findById(userJWT.id);
    user.favourites = user.favourites.filter((fav) => !fav.equals(productId));
    await user.save();

    return res
      .status(200)
      .json({ message: "Product removed from favorites successfully", user });
  } catch (err) {
    next(err);
  }
};

export const addToFavorites = async (req, res, next) => {
  try {
    const { productId } = req.body;
    const userJWT = req.user;
    const user = await User.findById(userJWT.id);

    if (!user.favourites.includes(productId)) {
      user.favourites.push(productId);
      await user.save();
    }

    return res
      .status(200)
      .json({ message: "Product added to favorites successfully", user });
  } catch (err) {
    next(err);
  }
};


export const getUserFavorites = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate("favourites").exec();
    if (!user) {
      return next(createError(404, "User not found"));
    }
    const favoriteProducts = user.favourites;
    return res.status(200).json(favoriteProducts);
  } catch (err) {
    next(err);
  }
};

//detail user
export const getDetailUser = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findOne({ _id: userId })
      .select('-password') // Loại password
      .populate('favourites')
      .populate({
        path: 'orders',
        populate: {
          path: 'products.product',
          model: 'Food',
        },
      })
      .populate('cart.product')
      .exec();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

export const updateDetailUser = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { name, email, img } = req.body;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, email, img },
      { new: true } // Trả về đối tượng sau khi đã cập nhật
    );
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
}
//search
export const searchFood = async (req, res, next) => {
  const { name } = req.query;
  if (!name) {
    return res.status(400).json({ success: false, message: "Name parameter is required." });
  }
  try {
    const foods = await Food.find({
      name: { $regex: new RegExp(name, "i") }
    });
    if (foods.length === 0) {
      res.json({ success: true, message: "No data found", data: [] });
    }
    res.json({ success: true, data: foods });
  } catch (error) {
    next(error);
  }
};

