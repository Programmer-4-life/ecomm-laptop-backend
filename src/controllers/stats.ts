import { createDecipheriv } from "crypto";
import { myCache } from "../app.js";
import { TryCatch } from "../middlewares/error.js";
import { Order } from "../models/order.js";
import { Product } from "../models/product.js";
import { User } from "../models/user.js";
import { calculatePercentage, getChartData, getInventories } from "../utils/features.js";

export const getDashboardStats = TryCatch(
  async (req, res, next) => {

    let stats = {};

    if (myCache.has("admin-stats")) {
      stats = JSON.parse(myCache.get("admin-stats") as string)
    }
    else {
      const today = new Date()
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

      const thisMonth = {
        start: new Date(today.getFullYear(), today.getMonth(), 1),
        end: today
      }

      const lastMonth = {
        start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        end: new Date(today.getFullYear(), today.getMonth(), 0)
      }

      const thisMonthProductsPromise = Product.find({
        createdAt: {
          $gte: thisMonth.start,
          $lte: thisMonth.end,
        },
      })

      const lastMonthProductsPromise = Product.find({
        createdAt: {
          $gte: lastMonth.start,
          $lte: lastMonth.end,
        },
      })

      const thisMonthUsersPromise = User.find({
        createdAt: {
          $gte: thisMonth.start,
          $lte: thisMonth.end,
        },
      })

      const lastMonthUsersPromise = User.find({
        createdAt: {
          $gte: lastMonth.start,
          $lte: lastMonth.end,
        },
      })

      const thisMonthOrdersPromise = Order.find({
        createdAt: {
          $gte: thisMonth.start,
          $lte: thisMonth.end,
        },
      })

      const lastMonthOrdersPromise = Order.find({
        createdAt: {
          $gte: lastMonth.start,
          $lte: lastMonth.end,
        },
      })

      const lastSixMonthOrdersPromise = Order.find({
        createdAt: {
          $gte: sixMonthsAgo,
          $lte: today,
        },
      })

      const latestTransactionsPromise = Order.find({}).select(["orderItems", "discount", "total", "status"]).limit(4)


      // so that ye ek sath synchronous chalein
      const [
        thisMonthProducts,
        thisMonthUsers,
        thisMonthOrders,
        lastMonthProducts,
        lastMonthUsers,
        lastMonthOrders,
        productsCount,
        usersCount,
        allOrders,
        lastSixMonthOrders,
        categories,
        femaleUsersCount,
        latestTransactions,
      ] = await Promise.all([
        thisMonthProductsPromise,
        thisMonthUsersPromise,
        thisMonthOrdersPromise,
        lastMonthProductsPromise,
        lastMonthUsersPromise,
        lastMonthOrdersPromise,
        Product.countDocuments(),
        User.countDocuments(),
        Order.find({}).select("total"),
        lastSixMonthOrdersPromise,
        Product.distinct("category"),
        User.countDocuments({ gender: "female" }),
        latestTransactionsPromise,
      ])

      const thisMonthRevenue = thisMonthOrders.reduce(
        (total, order) => total + (order.total || 0), 0
      )

      const lastMonthRevenue = lastMonthOrders.reduce(
        (total, order) => total + (order.total || 0), 0
      )

      const changePercentage = {
        revenue: calculatePercentage(thisMonthRevenue, lastMonthRevenue),

        product: calculatePercentage(thisMonthProducts.length, lastMonthProducts.length),

        user: calculatePercentage(thisMonthUsers.length, lastMonthUsers.length),

        order: calculatePercentage(thisMonthOrders.length, lastMonthOrders.length)
      }

      const revenue = allOrders.reduce(
        (total, order) => total + (order.total || 0), 0
      )

      const count = {
        revenue: revenue,
        user: usersCount,
        product: productsCount,
        order: allOrders.length,
      }

      const orderMonthCounts = new Array(6).fill(0)
      const orderMonthlyRevenue = new Array(6).fill(0)

      lastSixMonthOrders.forEach((order) => {
        const creationDate = order.createdAt
        const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12

        if (monthDiff < 6) {
          orderMonthCounts[5 - monthDiff] += 1
          orderMonthlyRevenue[5 - monthDiff] += order.total
        }
      })

      const categoryCount = await getInventories({
        categories,
        productsCount
      })

      const userRatio = {
        male: usersCount - femaleUsersCount,
        female: femaleUsersCount,
      }

      const modifiedLatestTransactions = latestTransactions.map(i => ({
        _id: i._id,
        discount: i.discount,
        amount: i.total,
        quantity: i.orderItems.length,
        status: i.status,
      }))

      stats = {
        categoryCount,
        changePercentage,
        count,
        chart: {
          order: orderMonthCounts,
          revenue: orderMonthlyRevenue,
        },
        userRatio,
        latestTransactions: modifiedLatestTransactions,
      }

      myCache.set("admin-stats", JSON.stringify(stats))
    }

    return res.status(200).json({
      success: true,
      stats
    })
  }
)

export const getPieCharts = TryCatch(
  async (req, res, next) => {

    let charts;

    if (myCache.has("admin-pie-charts")) {
      charts = JSON.parse(myCache.get("admin-pie-charts") as string)
    }
    else {
      const [
        processingOrder,
        deliveredOrder,
        shippedOrder,
        categories,
        productsCount,
        productsOutOfStock,
        allOrders,
        allUsers,
        adminUsers,
        customerUsers,
      ] = await Promise.all([
        Order.countDocuments({ status: "Processing" }),
        Order.countDocuments({ status: "Delivered" }),
        Order.countDocuments({ status: "Shipped" }),
        Product.distinct("category"),
        Product.countDocuments(),
        Product.countDocuments({ stock: 0 }),
        Order.find({}).select(["total", "discount", "subtotal", "tax", "shippingCharges"]),
        User.find({}).select(["dob"]),
        User.countDocuments({ role: "admin" }),
        User.countDocuments({ role: "user" }),
      ])

      const orderFullfillment = {
        processing: processingOrder,
        shipped: shippedOrder,
        delivered: deliveredOrder,
      }

      const productCategories = await getInventories({
        categories,
        productsCount
      })

      const stockAvailibility = {
        inStock: productsCount - productsOutOfStock,
        outOfStock: productsOutOfStock,
      }

      const grossIncome = allOrders.reduce(
        (prev, order) => prev + (order.total || 0),
        0
      )

      const discount = allOrders.reduce(
        (prev, order) => prev + (order.discount || 0),
        0
      )

      const productionCost = allOrders.reduce(
        (prev, order) => prev + (order.shippingCharges || 0),
        0
      )

      const burnt = allOrders.reduce(
        (prev, order) => prev + (order.tax || 0),
        0
      )

      const marketingCost = Math.round(grossIncome * (30 / 100))

      const netMargin = grossIncome - discount - productionCost - burnt - marketingCost

      const revenueDistribution = {
        netMargin,
        discount,
        productionCost,
        burnt,
        marketingCost,
      }

      const usersAgeGroup = {
        teen: allUsers.filter(i => i.age < 20).length,
        adult: allUsers.filter(i => i.age >= 20 && i.age < 40).length,
        old: allUsers.filter(i => i.age >= 40).length,
      }

      const adminCustomer = {
        admin: adminUsers,
        customer: customerUsers,
      }

      const charts = {
        orderFullfillment,
        productCategories,
        stockAvailibility,
        revenueDistribution,
        adminCustomer,
        usersAgeGroup,
      }

      myCache.set("admin-pie-charts", JSON.stringify(charts))
    }

    return res.status(200).json({
      success: true,
      charts,
    })
  }
)

export const getBarCharts = TryCatch(
  async (req, res, next) => {

    let charts;

    const key = "admin-bar-charts";

    if (myCache.has(key)) {
      charts = JSON.parse(myCache.get(key) as string)
    }
    else {

      const today = new Date()

      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

      const lastSixMonthsProductsPromise = Product.find({
        createdAt: {
          $gte: sixMonthsAgo,
          $lte: today,
        }
      }).select("createdAt")

      const lastSixMonthsUsersPromise = User.find({
        createdAt: {
          $gte: sixMonthsAgo,
          $lte: today,
        }
      }).select("createdAt")

      const lastTwelveMonthsOrdersPromise = Order.find({
        createdAt: {
          $gte: twelveMonthsAgo,
          $lte: today,
        }
      }).select("createdAt")

      const [
        products,
        users,
        orders,
      ] = await Promise.all([
        lastSixMonthsProductsPromise,
        lastSixMonthsUsersPromise,
        lastTwelveMonthsOrdersPromise,
      ])

      console.log("products", products)

      const productCounts = getChartData({ length: 6, docArr: products, today })

      const usersCounts = getChartData({ length: 6, docArr: users, today })

      const ordersCounts = getChartData({ length: 12, docArr: orders, today })

      console.log("users", usersCounts)

      charts = {
        users: usersCounts,
        products: productCounts,
        orders: ordersCounts,
      }

      myCache.set(key, JSON.stringify(charts))
    }

    return res.status(200).json({
      success: true,
      charts,
    })
  }
)

export const getLineCharts = TryCatch(
  async (req, res, next) => {
    let charts;

    const key = "admin-line-charts";

    if (myCache.has(key)) {
      charts = JSON.parse(myCache.get(key) as string)
    }
    else {

      const today = new Date()

      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

      const lastTwelveMonthsProductsPromise = Product.find({
        createdAt: {
          $gte: twelveMonthsAgo,
          $lte: today,
        }
      }).select(["createdAt", "discount", "total"])

      const lastTwelveMonthsUsersPromise = User.find({
        createdAt: {
          $gte: twelveMonthsAgo,
          $lte: today,
        }
      }).select(["createdAt", "discount", "total"])

      const lastTwelveMonthsOrdersPromise = Order.find({
        createdAt: {
          $gte: twelveMonthsAgo,
          $lte: today,
        }
      }).select(["createdAt", "discount", "total"])

      const [
        products,
        users,
        orders,
      ] = await Promise.all([
        lastTwelveMonthsProductsPromise,
        lastTwelveMonthsUsersPromise,
        lastTwelveMonthsOrdersPromise,
      ])

      const productCounts = getChartData({ length: 12, docArr: products, today })

      const usersCounts = getChartData({ length: 12, docArr: users, today })

      const discount = getChartData({
        length: 12,
        docArr: orders,
        today,
        property: "discount"
      })

      const revenue = getChartData({
        length: 12,
        docArr: orders,
        today,
        property: "total"
      })

      charts = {
        users: usersCounts,
        products: productCounts,
        discount,
        revenue,
      }

      myCache.set(key, JSON.stringify(charts))
    }

    return res.status(200).json({
      success: true,
      charts,
    })
  }
)