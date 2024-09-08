import { Request } from "express";
import { TryCatch } from "../middlewares/error.js";
import { BaseQuery, NewProductRequestBody, SearchRequestQuery } from "../types/types.js";
import { Product } from "../models/product.js";
import ErrorHandler from "../utils/utility-class.js";
import { rm } from "fs";
import { myCache } from "../app.js";
import { invalidateCache } from "../utils/features.js";
// import { faker } from "@faker-js/faker"

//Revalidate on New, Update, Delete Product & on New Order wrna cache sy same data ayega jo save tha cache mai
export const getLatestProducts = TryCatch(async (req, res, next) => {
  let products;

  if (myCache.has("latest-products")) {
    products = JSON.parse(myCache.get("latest-products")!)
  }
  //createdAt: 1 means ascending, createdAt: -1 means descending, limit(5) means only latest 5 products milengi
  else {
    products = await Product.find({}).sort({ createdAt: -1 }).limit(5)
    myCache.set("latest-products", JSON.stringify(products))
  }

  return res.status(200).json({
    success: true,
    products,
  })
})

//Revalidate on New, Update, Delete Product & on New Order wrna cache sy same data ayega jo save tha cache mai
export const getAllCategories = TryCatch(async (req, res, next) => {
  let categories;

  if (myCache.has("categories")) {
    categories = JSON.parse(myCache.get("categories")!)
  }
  else {
    categories = await Product.distinct("category")
    myCache.set("categories", JSON.stringify(categories))
  }

  return res.status(200).json({
    success: true,
    categories,
  })
})

//Revalidate on New, Update, Delete Product & on New Order wrna cache sy same data ayega jo save tha cache mai
export const getAdminProducts = TryCatch(async (req, res, next) => {
  let products;

  if (myCache.has("all-products")) {
    products = JSON.parse(myCache.get("all-products")!)
    console.log("Cached Products:", products);
  }
  else {
    products = await Product.find({})
    myCache.set("all-products", JSON.stringify(products))
  }

  return res.status(200).json({
    success: true,
    products,
  })
})


//Revalidate on New, Update, Delete Product & on New Order wrna cache sy same data ayega jo save tha cache mai
export const getSingleProduct = TryCatch(async (req, res, next) => {
  let product;
  const id = req.params.id;

  if (myCache.has(`product-${id}`)) {
    product = JSON.parse(myCache.get(`product-${id}`)!)
  }
  else {
    const product = await Product.findById(id)
    if (!product) return next(new ErrorHandler("Product Not Found", 404))

    myCache.set(`product-${id}`, JSON.stringify(product))
  }

  return res.status(200).json({
    success: true,
    product,
  })
})

export const newProduct = TryCatch(async (
  req: Request<{}, {}, NewProductRequestBody>,
  res,
  next
) => {
  const { name, price, stock, category } = req.body;
  const photo = req.file;

  if (!photo) {
    return next(new ErrorHandler("Please Add Photo", 400))
  }

  if (!name || !price || !stock || !category) {
    //to remove photo agr inmei sy koi bhi exist na krta ho wrna photo add hojaegi upload folder mai
    rm(photo.path, () => {
      console.log("deleted")
    })

    return next(new ErrorHandler("Please enter All Fields", 400))
  }

  await Product.create({
    name,
    price,
    stock,
    category: category.toLocaleLowerCase(),
    photo: photo.path,
  })

  invalidateCache({ product: true, admin: true })

  return res.status(201).json({
    success: true,
    message: "Product Created Successfully",
  })

})

export const updateProduct = TryCatch(async (req, res, next) => {
  const { id } = req.params
  const { name, price, stock, category } = req.body
  const photo = req.file
  const product = await Product.findById(id)

  if (!product) {
    return next(new ErrorHandler("Product Not Found", 404))
  }

  if (photo) {
    //product.photo!, ! is sy value undefine nhi hogi photo ki
    rm(product.photo!, () => {
      console.log("Old Photo Deleted")
    })

    product.photo = photo.path
  }

  if (name) product.name = name;
  if (price) product.price = price;
  if (stock) product.stock = stock;
  if (category) product.category = category;

  await product.save();
  invalidateCache({ product: true, admin: true, productId: String(product._id) })

  return res.status(200).json({
    success: true,
    message: "Product Updated Successfully",
  })
})

export const deleteProduct = TryCatch(async (req, res, next) => {
  const product = await Product.findById(req.params.id)

  if (!product) {
    return next(new ErrorHandler("Product Not Found", 404))
  }

  //before deleting a product photo delete krengy upload folder sy
  rm(product.photo!, () => {
    console.log("Product Photo Deleted")
  })

  await product.deleteOne()
  invalidateCache({ product: true, admin: true, productId: String(product._id) })

  return res.status(200).json({
    success: true,
    message: "Product Deleted Successfully",
  })
})

export const getAllProducts = TryCatch(async (
  req: Request<{}, {}, {}, SearchRequestQuery>,
  res,
  next
) => {
  const { search, sort, category, price } = req.query

  const page = Number(req.query.page) || 1
  const limit = Number(process.env.PRODUCT_PER_PAGE) || 8
  const skip = limit * (page - 1)

  /*const baseQuery = {
    name: {//regex pattern dhoondhega
      $regex: search,
      $options: "i", //case sensitive ab capital small letter ko ek hi consider krega
    },
    price: {
      $lte: Number(price),
    },
    category: category, //simple category bhi likh skty thy cuz key value pair same hain
  } */

  const baseQuery: BaseQuery = {}

  if (search) {
    baseQuery.name = {
      $regex: search,
      $options: "i",
    }
  }

  if (price) {
    baseQuery.price = {
      $lte: Number(price),
    }
  }

  if (category) { baseQuery.category = category }

  const productsPromise = Product.find(baseQuery)
    .sort(sort && { price: sort === "asc" ? 1 : -1 })
    .limit(limit)
    .skip(skip);

  //Promise.all parallel chalayega dono await ko
  const [products, filteredOnlyProducts] = await Promise.all([
    productsPromise,
    Product.find(baseQuery),
  ])

  const totalPage = Math.ceil(filteredOnlyProducts.length / limit);

  return res.status(200).json({
    success: true,
    products,
    totalPage,
  })
})

//for generating random data to check pagination
// const generateRandomProducts = async (count: number = 10) => {
//   const products = [];

//   for (let i = 0; i < count; i++) {
//     const product = {
//       name: faker.commerce.productName(),
//       photo: "uploads\ef429be2-930a-454f-9907-64212b83b994.png",
//       price: faker.commerce.price({ min: 1500, max: 200000, dec: 0 }),
//       stock: faker.commerce.price({ min: 0, max: 100, dec: 0 }),
//       category: faker.commerce.department(),
//       createdAt: new Date(faker.date.past()),
//       updatedAt: new Date(faker.date.recent()),
//       __v: 0,
//     }
//     products.push(product)
//   }
//   await Product.create(products)
// }

// generateRandomProducts(40)

// const deleteRandomProducts = async (count: number = 10) => {
//   const products = await Product.find({}).skip(3)

//   for (let i = 0; i < products.length; i++) {
//     const product = products[i];
//     await product.deleteOne()
//   }
// }

// deleteRandomProducts(35)