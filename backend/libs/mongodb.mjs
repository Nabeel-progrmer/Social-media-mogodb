import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
if (process.env.VERCEL !== "1") {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
}

import mongoose from "mongoose";

let connectionAttempt;
let listenersAttached = false;

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const connect_database = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionAttempt) return connectionAttempt;

  connectionAttempt = (async () => {
    if (!listenersAttached) {
      listenersAttached = true;
      mongoose.connection.on("connected", () =>
        console.log("MongoDB connection established"),
      );
      mongoose.connection.on("reconnected", () =>
        console.log("MongoDB connection restored"),
      );
      mongoose.connection.on("disconnected", () =>
        console.warn("MongoDB connection lost; retrying"),
      );
      mongoose.connection.on("error", (error) => {
        console.error(
          `MongoDB connection error (${error.name || "unknown"}): ${error.message}`,
        );
      });
    }

    const uri = process.env.MONGO_DB_URI;
    if (!uri) throw new Error("MONGO_DB_URI is not configured");

    let retryDelay = 5_000;
    while (mongoose.connection.readyState !== 1) {
      try {
        await mongoose.connect(uri, {
          dbName: "project",
          serverSelectionTimeoutMS: 10_000,
          connectTimeoutMS: 10_000,
          socketTimeoutMS: 45_000,
        });
        console.log("MongoDB connection established");
        return mongoose.connection;
      } catch (error) {
        console.error(
          `MongoDB connection failed (${error.name || "unknown"}): ${error.message}`,
        );
        console.warn(
          `Retrying MongoDB connection in ${Math.round(retryDelay / 1000)} seconds`,
        );
        await wait(retryDelay);
        retryDelay = Math.min(retryDelay * 2, 60_000);
      }
    }

    return mongoose.connection;
  })().finally(() => {
    connectionAttempt = undefined;
  });

  return connectionAttempt;
};
