import express from "express"
import { isAdmin } from "../middlewares/auth.js"
import { deleteProduct, getAdminProducts, getAllCategories, getAllProducts, getLatestProducts, getSingleProduct, newProduct, updateProduct } from "../controllers/product.js";
import { singleUpload } from "../middlewares/multer.js";

const app = express.Router()

//Create new Product - /api/v1/product/new
app.post("/new", isAdmin, singleUpload, newProduct)
//get all products with filters
app.get("/all", getAllProducts)
app.get("/latest", getLatestProducts)
app.get("/categories", getAllCategories)
app.get("/admin-products", isAdmin, getAdminProducts)

app
  .route("/:id")
  .get(getSingleProduct)
  .put(isAdmin, singleUpload, updateProduct)
  .delete(isAdmin, deleteProduct)

/* 
app.get("/:id", getSingleProduct)
app.put("/:id",isAdmin, singleUpload, updateProduct)
app.delete("/:id", isAdmin, deleteProduct)
*/
export default app;