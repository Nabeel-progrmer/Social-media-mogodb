import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";

const uri = process.env.MONGO_DB_URI;

export const connect_database = async () => {
  if (!uri) {
    console.error("MongoDB URI required");
    return;
  }

  try {
    await mongoose.connect(uri, {
      dbName: "project",
    });

    console.log("mongoose is connected");
  } catch (error) {
    console.error(error);
    console.error("mongoose is disconnected");
  }
};