import { NextFunction, Request, Response } from "express";
import { User } from "../models/user.js";
import { NewUserRequestBody } from "../types/types.js";
import { TryCatch } from "../middlewares/error.js";
import ErrorHandler from "../utils/utility-class.js";

export const newUser = TryCatch(
  async (
    //  req: Request<{}, {}, {name: string}>,// alternate method if not defining types
    req: Request<{}, {}, NewUserRequestBody>,
    res: Response,
    next: NextFunction
  ) => {
    const { name, email, photo, gender, _id, dob } = req.body;
    console.log("hello", name, email, photo, gender, _id, dob);

    let fetchedUser = await User.findById(_id);

    if (fetchedUser) {
      return res.status(200).json({
        success: true,
        message: `Welcome, ${fetchedUser.name}`
      })
    }

    if (!_id || !name || !email || !photo || !gender || !dob) {
      return next(new ErrorHandler("Please add all fields", 400))
    }

    const user = await User.create({
      name,
      email,
      photo,
      gender,
      _id,
      dob: new Date(dob) //bcuz json data a rha hai
    })

    return res.status(201).json({
      success: true,
      message: `Welcome, ${user.name}`,
    })
  }
)

export const getAllUsers = TryCatch(async (req, res, next) => {
  const users = await User.find({})

  return res.status(200).json({
    success: true,
    users,
  })
})

export const getUser = TryCatch(async (req, res, next) => {
  const id = req.params.id;
  const user = await User.findById(id)

  if (!user) {
    return next(new ErrorHandler("Invalid Id", 400))
  }

  return res.status(200).json({
    success: true,
    user,
  })
})

export const deleteUser = TryCatch(async (req, res, next) => {
  const id = req.params.id;
  const user = await User.findById(id)

  if (!user) {
    return next(new ErrorHandler("Invalid Id", 400))
  }

  await user.deleteOne()

  return res.status(200).json({
    success: true,
    message: "User Deleted Successfully",
  })
})