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
