const express = require("express");
const app = express();
const { MongoClient, ObjectId } = require("mongodb");
const stripe = require("stripe")(
  "sk_test_51PNgLNRtOcwhWUJ1t6qbvvOvlHBWyuL2poBX64qLMpLyuwFvTB8tU41Rc0r7K3vcQrXdNypp8f8TynOtGfa6TsDn00MQhAf1Kl"
);
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const PORT = process.env.PORT || 5000;
const bodyParser = require("body-parser");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const upload = multer();

// Middleware
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zyr5lk0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: "1", // Adjusted to string '1' to match MongoDB driver requirements
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("mediDb");
    const userCollection = db.collection("users");
    const productsCollection = db.collection("products");
    const categoriesCollection = db.collection("categories");
    const cartCollection = db.collection("carts");
    const salesData = db.collection("saleReport");
    const paymentsCollection = db.collection("payments");
    const advertisementsCollection = db.collection("advertisements");

     // JWT related API
     app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
     // Middlewares
     const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };
       // use verify admin after verifyToken
       const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === "admin";
        if (!isAdmin) {
          return res.status(403).send({ message: "forbidden access" });
        }
        next();
      };
       // User related endpoints
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const user = await userCollection.findOne({ email });
      const isAdmin = user?.role === "admin";
      res.send({ admin: isAdmin });
    });
    app.get("/users/seller/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const user = await userCollection.findOne({ email });
      const isSeller = user?.role === "seller";
      res.send({ seller: isSeller });
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const existingUser = await userCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      const result = await userCollection.insertOne(user);
      res.status(201).json({
        message: "User created successfully",
        insertedId: result.insertedId,
      });
    });
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send(result);
    });

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = { $set: { role: "admin" } };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    app.patch(
      "/users/seller/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = { $set: { role: "seller" } };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );


  
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
    throw err;
  }
}

run().catch(console.dir);

// Default route
app.get("/", (req, res) => {
  res.send("Medi server is running");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Server Error");
});

app.listen(PORT, () => console.log(`Medi Server running on port ${PORT}`));
