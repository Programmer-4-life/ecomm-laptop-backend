import express from "express"
import { deleteUser, getAllUsers, getUser, newUser } from "../controllers/user.js"
import { isAdmin } from "../middlewares/auth.js"

const app = express.Router()

//route - /api/v1/user/new
app.post("/new", newUser)

//Route - /api/v1/user/all
app.get("/all", isAdmin, getAllUsers)

//Route - /api/v1/user/dynamicID
app.route("/:id").get(getUser).delete(isAdmin, deleteUser)
//we can use above line 13 route or below two routes
// app.get("/:id", getUser)
// app.delete("/:id", deleteUser)

export default app