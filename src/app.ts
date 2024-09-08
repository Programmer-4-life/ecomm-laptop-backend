import express from "express";
import cors from "cors"
import { connectDB } from "./utils/features.js";
import { errorMiddleware } from "./middlewares/error.js";
import NodeCache from "node-cache";
import { config } from "dotenv"
import morgan from "morgan"
import Stripe from "stripe";

//Importing routes
import userRoute from "./routes/user.js"
import productRoute from "./routes/products.js"
import orderRoute from "./routes/order.js"
import paymentRoute from "./routes/payment.js"
import dashboardRoute from "./routes/stats.js"

config({
  path: "./.env",
})

const port = process.env.PORT || 4000;
const mongoURI = process.env.MONGO_URI || "";
const stripeKey = process.env.STRIPE_KEY || ""

connectDB(mongoURI)

export const stripe = new Stripe(stripeKey)
export const myCache = new NodeCache()

const app = express();

app.use(express.json())
app.use(morgan("dev"))
app.use(cors()) //sab server/ url k liye allow hogaya hai backend api use krna

//specific url ko access deny k liye aesy likhengy
// app.use(cors({
//   origin: "http://localhost:5173",
//   methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
//   allowedHeaders: ["Content-Type", "Authorization"],
//   credentials: true,
// }))


app.options('*', cors());

app.get("/", (req, res) => {
  res.send("API working with /api/v1")
})

//Using routes
app.use("/api/v1/user", userRoute)
app.use("/api/v1/product", productRoute)
app.use("/api/v1/order", orderRoute)
app.use("/api/v1/payment", paymentRoute)
app.use("/api/v1/dashboard", dashboardRoute)

app.use("/uploads", express.static("uploads"))
//localhost://uploads/laptop.png ko display krwanay k liye
app.use(errorMiddleware)

app.listen(port, () => {
  console.log(`Server is running on port http://localhost: ${port}`);
})