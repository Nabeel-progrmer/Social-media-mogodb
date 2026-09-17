import "dotenv/config"
import express from "express"
import cors from "cors"
import postRoutes from "./libs/routes/post.js"
import { connect_database } from "./libs/mongodb.mjs"
import authRoutes from "./libs/routes/auth.js"
import profileRoutes from "./libs/routes/profile.js"
import { authGuardJWT } from "./middlewares/index.mjs"

const app = express()

app.use(express.json())

app.use(cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"]
}))

const PORT = process.env.PORT || 5002

app.get ("/",(req,res)=>{
    res.json({ message: "Social media API is running" })
})

app.use("/api/v1", authRoutes)
app.use("/api/v1", authGuardJWT)
app.use("/api/v1", postRoutes)
app.use("/api/v1", profileRoutes)


app.listen(PORT , ()=>{
    console.log("server is ok 200")
    connect_database()
})