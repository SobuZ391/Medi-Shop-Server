const express = require("express");
const app = express();
const { MongoClient, ObjectId } = require("mongodb");
const stripe = require("stripe")(
  `${process.env.STRIPE}`
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
    app.patch("/users/user/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = { $set: { role: "user" } };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
   // Category related endpoints
   app.get("/categories", async (req, res) => {
    const result = await categoriesCollection.find().toArray();
    res.send(result);
  });

  app.post("/categories", verifyToken, verifyAdmin, async (req, res) => {
    const newCategory = req.body;
    const result = await categoriesCollection.insertOne(newCategory);
    res.status(201).json(result);
  });

  app.put("/categories/:id", verifyToken, verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const updatedCategory = req.body;
    const result = await categoriesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedCategory }
    );
    res.json(result);
  });
  app.delete(
    "/categories/:id",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
      const { id } = req.params;
      const result = await categoriesCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.status(204).end();
    })
      // Product related endpoints
      app.get("/products", async (req, res) => {
        const result = await productsCollection.find().toArray();
        res.send(result);
      });
     
      app.post("/products", async (req, res) => {
        try {
          const newMedicine = req.body;
      
          // Log incoming data for debugging
          console.log("New Medicine Data:", newMedicine);
      
          // Validate incoming data (optional but recommended)
          if (!newMedicine.name || !newMedicine.price || !newMedicine.image) {
            return res.status(400).json({ message: "Invalid data" });
          }
      
          // Insert new medicine into the database
          const result = await productsCollection.insertOne(newMedicine);
      
          if (result.insertedId) {
            res.status(201).json({ message: "Medicine added successfully", id: result.insertedId });
          } else {
            res.status(500).json({ message: "Failed to add medicine" });
          }
        } catch (error) {
          console.error("Server Error:", error);
          res.status(500).json({ message: "Server Error", error: error.message });
        }
      });
      
    //categories related
    // GET all cart items
    app.get("/cart", async (req, res) => {
      try {
        const cartItems = await db.collection("cart").find().toArray();
        res.json(cartItems);
      } catch (error) {
        console.error("Error fetching cart items:", error.message);
        res.status(500).json({ error: "Server error" });
      }
    });

    // Route to handle adding medicine to cart
    app.post("/cart", async (req, res) => {
      const { medicine } = req.body;

      try {
        // Insert the medicine into the cart collection
        const result = await cartCollection.insertOne(medicine);

        console.log("Medicine added to cart:", result.insertedId);

        res
          .status(200)
          .json({ message: "Medicine added to cart successfully" });
      } catch (error) {
        console.error("Error adding medicine to cart:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });
    // DELETE remove an item from cart
    app.delete("/cart/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await db
          .collection("cart")
          .deleteOne({ _id: ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).json({ error: "Item not found" });
        }
        res.status(204).json({ message: "Item deleted successfully" });
      } catch (error) {
        console.error("Error deleting item from cart:", error.message);
        res.status(500).json({ error: "Server error" });
      }
    });
    // Route to create a payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { amount } = req.body;

      try {
        // Create a PaymentIntent with the specified amount
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: "usd", // adjust currency as needed
        });

        // Send client secret to frontend
        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).json({ error: "Failed to create payment intent" });
      }
    });
 
  // Route to handle payment confirmation and saving data to the database
  app.post("/confirm-payment", async (req, res) => {
    const { paymentIntentId, amount, status, email, mediName } = req.body;
    try {
      const paymentData = {
        paymentIntentId,
        amount,
        status,
        email,
        mediName,
        date: new Date(),
      };

      const result = await paymentsCollection.insertOne(paymentData);

      console.log("Payment confirmation added to database:", result.insertedId);

      res.status(200).json({ message: "Payment confirmation saved successfully" });
    } catch (error) {
      console.error("Error saving payment confirmation:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { email };
      const result = await paymentsCollection.find(query).toArray();
      res.send(result);
    });
    app.get('/payments', async (req, res) => {
      try {
        const payments = await paymentsCollection.find({}).toArray();
        console.log('Payments:', payments); // Log the query result
        res.json(payments);
      } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

  // Endpoint to update payment status
  app.patch('/payments/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      const payment = await paymentsCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { status } },
        { returnOriginal: false }
      );
      res.json(payment.value);
    } catch (error) {
      console.error('Error updating payment:', error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/sales-report", (req, res) => {
    const { startDate, endDate } = req.query;
    let filteredSales = salesData;
    if (startDate && endDate) {
      filteredSales = salesData.filter((sale) => {
        const saleDate = new Date(sale.date);
        return (
          saleDate >= new Date(startDate) && saleDate <= new Date(endDate)
        );
      });
    }
    res.json(filteredSales);
  });

  
// Dummy function to generate report (Replace this with actual report generation logic)
const generateReport = (format, startDate, endDate) => {
const reportData = `Report from ${startDate} to ${endDate}`;
const filePath = path.join(__dirname, `sales_report.${format}`);
fs.writeFileSync(filePath, reportData);
return filePath;
};

// Endpoint to generate and download PDF report
app.get('/reports/pdf', async (req, res) => {
const { startDate, endDate } = req.query;

try {
  // Fetch sales data from the `/payments` endpoint
  const response = await axios.get(`http://localhost:${port}/payments`, {
    params: { startDate, endDate }
  });
  const salesData = response.data;

  // Generate PDF report
  const pdfFileName = `sales_report_${startDate}_${endDate}.pdf`;

  // Placeholder for actual PDF generation logic (using libraries like `pdfkit`, `jspdf`, or `react-pdf`)
  // Example: Using `file-saver` to create a downloadable file
  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'red';
  ctx.fillRect(10, 10, 100, 100);

  const stream = canvas.createPDFStream();
  stream.pipe(createWriteStream(pdfFileName));

  stream.on('finish', function () {
    saveAs(pdfFileName, pdfFileName);
  });

  res.end();
} catch (error) {
  console.error('Error generating PDF report:', error);
  res.status(500).json({ error: 'Internal server error' });
}
});
// Admin routes
app.get('/admin/advertisements', async (req, res) => {
try {
  const advertisements = await advertisementsCollection.find().toArray();
  res.json(advertisements);
} catch (err) {
  console.error('Error fetching advertisements:', err);
  res.status(500).send('Error fetching advertisements');
}
});

app.patch('/admin/advertisements/:id', async (req, res) => {
try {
  const id = req.params.id;
  const inSlide = req.body.in_slide;

  // Validate the ID
  if (!ObjectId.isValid(id)) {
    return res.status(400).send('Invalid advertisement ID');
  }

  const result = await advertisementsCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { in_slide: inSlide } }
  );

  if (result.modifiedCount === 1) {
    res.send('Advertisement updated successfully');
  } else {
    res.status(404).send('Advertisement not found');
  }
} catch (err) {
  console.error('Error updating advertisement:', err);
  res.status(500).send('Error updating advertisement');
}
});

// Seller routes
app.get('/seller/referred-medicines', async (req, res) => {
try {
  const sellerEmail = req.query.sellerEmail; // Fetch the sellerEmail from the query parameter
  const medicines = await advertisementsCollection.find({ sellerEmail }).toArray();
  res.json(medicines);
} catch (err) {
  console.error('Error fetching referred medicines:', err);
  res.status(500).send('Error fetching referred medicines');
}
});


// Route to add advertisement
app.post('/seller/advertisements', async (req, res) => {
try {
  const newAd = {
    sellerEmail: req.body.sellerEmail,
    image: req.body.image,
    description: req.body.description,
    mediName: req.body.name,
    in_slide: false,
  };

  const result = await advertisementsCollection.insertOne(newAd);

  if (result.acknowledged) {
    res.status(201).send('Advertisement added successfully');
  } else {
    res.status(500).send('Error adding advertisement');
  }
} catch (err) {
  console.error('Error adding advertisement:', err);
  res.status(500).send('Error adding advertisement');
}
});
// Backend route to update the status of an advertisement
app.put('/seller/advertisements/:id', async (req, res) => {
try {
  const { id } = req.params;
  const { in_slider } = req.body;

  const updateResult = await advertisementsCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { in_slider: in_slider } }
  );

  if (updateResult.modifiedCount === 1) {
    res.json({ message: 'Advertisement status updated successfully' });
  } else {
    res.status(404).json({ message: 'Advertisement not found' });
  }
} catch (err) {
  console.error('Error updating advertisement status:', err);
  res.status(500).send('Error updating advertisement status');
}
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
