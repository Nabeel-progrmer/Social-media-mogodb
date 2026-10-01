import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
if (process.env.VERCEL !== "1") {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
}

import mongoose from "mongoose";

let connectionAttempt;
let listenersAttached = false;

export const connect_database = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionAttempt) return connectionAttempt;

  const uri = process.env.MONGO_DB_URI;
  if (!uri) throw new Error("MONGO_DB_URI is not configured");

  if (!listenersAttached) {
    listenersAttached = true;
    mongoose.connection.on("connected", () =>
      console.log("MongoDB connection established"),
    );
    mongoose.connection.on("reconnected", () =>
      console.log("MongoDB connection restored"),
    );
    mongoose.connection.on("disconnected", () =>
      console.warn("MongoDB connection lost"),
    );
    mongoose.connection.on("error", (error) => {
      console.error(
        `MongoDB connection error (${error.name || "unknown"}): ${error.message}`,
      );
    });
  }

  connectionAttempt = mongoose
    .connect(uri, {
      dbName: "project",
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
    })
    .then(() => mongoose.connection)
    .catch((error) => {
      console.error(
        `MongoDB connection failed (${error.name || "unknown"}): ${error.message}`,
      );
      throw error;
    })
    .finally(() => {
      connectionAttempt = undefined;
    });

  return connectionAttempt;
};
