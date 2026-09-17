import express from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { UserModel } from "../models/users/index.mjs"
import { emailPattern, passwardPattern } from "../../utilitis/core.mjs"

const authRoutes = express.Router()

authRoutes.post("/signup", async (req, res) => {
  try {
    const { firstname, lastname, email, passward } = req.body

    if (!firstname) {
      return res.status(400).send({ message: "firstname is required" })
    }

    if (!lastname) {
      return res.status(400).send({ message: "lastname is required" })
    }

    if (!email) {
      return res.status(400).send({ message: "email is required" })
    }

    if (!passward) {
      return res.status(400).send({ message: "passward is required" })
    }

    if (!emailPattern.test(email.toLowerCase())) {
      return res.status(400).send({ message: "email is invalid" })
    }

    if (!passwardPattern.test(passward)) {
      return res.status(400).send({ message: "passward must be strong" })
    }

    const normalizedEmail = email.toLowerCase()
    const existingUser = await UserModel.findOne({ email: normalizedEmail })

    if (existingUser) {
      return res.status(400).send({ message: "email is already taken" })
    }

    const passwardHash = await bcrypt.hash(passward, 12)

    const userAccount = await UserModel.create({
      firstname,
      lastname,
      email: normalizedEmail,
      passward: passwardHash,
    })

    const token = jwt.sign(
      {
        email: userAccount.email,
        _id: userAccount._id,
      },
      process.env.JWT_KEY,
      { expiresIn: "1d" }
    )

    return res.send({
      message: "sign up complete",
      data: token,
      user: {
        _id: userAccount._id,
        firstname: userAccount.firstname,
        lastname: userAccount.lastname,
        email: userAccount.email,
      },
    })
  } catch (error) {
    console.error(error)
    return res.status(500).send({ message: "internal server error" })
  }
})

authRoutes.post("/login", async (req, res) => {

  console.log("currentUser from login api ==>",req.currentUser)

  try {
    const email = req.body.email
    const passward = req.body.passward

    if (!email) {
      return res.status(400).send({ message: "email is required" })
    }

    if (!passward) {
      return res.status(400).send({ message: "passward is required" })
    }

    if (!emailPattern.test(email.toLowerCase())) {
      return res.status(400).send({ message: "email or passward is incorrect" })
    }

    const normalizedEmail = email.toLowerCase()
    const userAccount = await UserModel.findOne({ email: normalizedEmail })

    if (!userAccount) {
      return res.status(400).send({ message: "invalid credential" })
    }

    const isPasswardTrue = await bcrypt.compare(passward, userAccount.passward)

    if (!isPasswardTrue) {
      return res.status(400).send({ message: "invalid credential" })
    }

    const token = jwt.sign(
      {
        email: userAccount.email,
        _id: userAccount._id,
      },
      process.env.JWT_KEY,
      { expiresIn: "1d" }
    )

    return res.send({
      message: "login done",
      data: token,
      user: {
        _id: userAccount._id,
        firstname: userAccount.firstname,
        lastname: userAccount.lastname,
        email: userAccount.email,
      },
    })
  } catch (error) {
    console.error(error)
    return res.status(500).send({ message: "internal server error" })
  }
})

export default authRoutes

