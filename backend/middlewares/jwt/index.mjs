import jwt from "jsonwebtoken";
import { UserModel } from "../../libs/models/users/index.mjs";

export const authGuardJWT = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;
    const token = req.headers.token || authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).send({
        message: "unauthorized",
      });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_KEY);
    const currentUser = await UserModel.findOne({ _id: decodedToken._id });

    if (!currentUser) {
      return res.status(401).send({ message: "unauthorized" });
    }

    req.currentUser = currentUser;
    next();
  } catch (error) {
    console.error(error);
    return res.status(401).send({
      message: "unauthorized",
    });
  }
};
