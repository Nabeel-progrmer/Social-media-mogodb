import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import postRoutes from "./libs/routes/post.js";
import { connect_database } from "./libs/mongodb.mjs";
import authRoutes from "./libs/routes/auth.js";
import profileRoutes from "./libs/routes/profile.js";
import chatRoutes from "./libs/routes/chat.js";
import { attachChatSockets } from "./libs/chat/socket.mjs";
import { authGuardJWT } from "./middlewares/index.mjs";
import { allowedOrigins } from "./utilitis/core.mjs";

const app = express();
const verifyEmailPage = fileURLToPath(new URL("./verify-email.html", import.meta.url));

app.use(express.json());

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
  }),
);

const PORT = process.env.PORT || 5002;

app.get("/", (req, res) => {
  res.json({ message: "Social media API is running" });
});

app.get("/verify-email", (req, res, next) => {
  readFile(verifyEmailPage, "utf8")
    .then((html) => res.type("html").send(html))
    .catch(next);
});

app.use(
  "/api/v1",
  authRoutes,
  authGuardJWT,
  postRoutes,
  profileRoutes,
  chatRoutes,
);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
});
app.set("io", io);
attachChatSockets(io);

httpServer.listen(PORT, () => {
  console.log("server is ok 200");
  connect_database();
});
