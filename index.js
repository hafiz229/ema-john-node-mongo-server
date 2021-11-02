const express = require("express");
const { MongoClient } = require("mongodb");
require("dotenv").config();
const cors = require("cors");
// for jwt token
var admin = require("firebase-admin");
// above one is enough, so ignore the below line
// const { initializeApp } = require("firebase-admin/app");

const app = express();
const port = process.env.PORT || 5000;

// firebase admin initialization

var serviceAccount = require("./ema-john-simple-1045c-firebase-adminsdk-dfc9t-0e0a8fcfbc.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5rymw.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// async function to verify jwt token
async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    // get the token by spliting the whole string
    const idToken = req.headers.authorization.split("Bearer ")[1];
    try {
      // verify the email
      const decodedUser = await admin.auth().verifyIdToken(idToken);
      // get the email
      req.decodedUserEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("online_shop");
    const productCollection = database.collection("products");
    const orderCollection = database.collection("orders");

    // GET Products API
    app.get("/products", async (req, res) => {
      const cursor = productCollection.find({});
      // get current page and size from query
      const page = req.query.page;
      const size = parseInt(req.query.size);
      let products;
      // count total products
      const count = await cursor.count();
      if (page) {
        products = await cursor
          .skip(page * size)
          .limit(size)
          .toArray();
      } else {
        products = await cursor.toArray();
      }

      res.send({ count, products });
    });

    // Use POST to get data by keys
    app.post("/products/byKeys", async (req, res) => {
      const keys = req.body;
      const query = { key: { $in: keys } };
      const products = await productCollection.find(query).toArray();
      res.send(products);
    });

    // Get Orders API (GET)
    app.get("/orders", verifyToken, async (req, res) => {
      const email = req.query.email; // get current users email
      // only give information if both the email matched
      if (req.decodedUserEmail === email) {
        // set current users email to query
        const query = { email: email };
        // pass the query
        const cursor = orderCollection.find(query);
        const orders = await cursor.toArray();
        res.json(orders);
      } else {
        res.status(401).json({ message: "Unauthorize User" });
      }
    });

    // Add Orders API (POST)
    app.post("/orders", async (req, res) => {
      const order = req.body;
      order.createdAt = new Date();
      const result = await orderCollection.insertOne(order);
      res.json(result);
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Ema john server is running");
});

app.listen(port, () => {
  console.log("Server running at port:", port);
});
