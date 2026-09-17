import express from "express"
import bcrypt from "bcryptjs"
import { UserModel } from "../models/users/index.mjs"

const router = express.Router()

router.get("/profile", async (req, res) => {
  const user = await UserModel.findById(req.currentUser._id).select("firstname lastname email")
  return res.send({
    message: "profile is fetched",
    data: user || req.currentUser,
  })
})

router.put("/profile", async (req, res) => {
  try {
    const user = await UserModel.findByIdAndUpdate(
      req.currentUser._id,
      {
        $set: {
          ...(req.body.firstname && { firstname: req.body.firstname }),
          ...(req.body.lastname && { lastname: req.body.lastname }),
        },
      },
      { new: true }
    )

    if (!user) {
      return res.status(404).send({ message: "account not found" })
    }

    return res.send({ message: "profile updated", data: user })
  } catch (error) {
    console.error(error)
    return res.status(500).send({ message: "internal server error" })
  }
})

router.put("/passward", async (req, res) => {
  try {
    const { currentPassward, newPassward } = req.body
    if (!currentPassward || !newPassward) {
      return res.status(400).send({ message: "both passwords are required" })
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassward, req.currentUser.passward)
    if (!isCurrentPasswordValid) {
      return res.status(400).send({ message: "current passward is invalid" })
    }

    const passward = await bcrypt.hash(newPassward, 12)
    await UserModel.findByIdAndUpdate(req.currentUser._id, { $set: { passward } })
    return res.send({ message: "passward is updated" })
  } catch (error) {
    console.error(error)
    return res.status(500).send({ message: "internal server error" })
  }
})

export default router
