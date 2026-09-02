const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const { MongoClient, ServerApiVersion } = require("mongodb");

dotenv.config();

const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let facilitiesCollection;

async function run() {
  try {
    await client.connect();

    const db = client.db("playplex");

    facilitiesCollection = db.collection("facilities");

    await client.db("admin").command({ ping: 1 });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

run();


// Home route
app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

// Get all facilities
app.get("/facilities", async (req, res) => {
  try {
    const facilities = await facilitiesCollection.find().toArray();

    res.send(facilities);
  } catch (error) {
    console.error(error);

    res.status(500).send({
      message: "Failed to get facilities",
    });
  }
});

//post all facilities


app.post("/facilities", async (req, res) => {
  try {
    const {
      name,
      type,
      image,
      location,
      price,
      pricePerHour,
      capacity,
      availableSlots,
      availableTimeSlots,
      description,
      ownerEmail,
    } = req.body;

    const rate = pricePerHour || price;
    const slots = availableSlots || availableTimeSlots;

    // Basic Validation
    if (!name || !rate || !ownerEmail) {
      return res.status(400).json({ message: "Required fields are missing." });
    }

    const newFacility = {
      name,
      type,
      image,
      location,
      price: parseFloat(rate),
      pricePerHour: parseFloat(rate),
      capacity: parseInt(capacity, 10),
      availableSlots: slots,
      availableTimeSlots: slots,
      description,
      ownerEmail,
      createdAt: new Date(),
    };

    const result = await facilitiesCollection.insertOne(newFacility);
    res.status(201).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error("Error inserting facility:", error);
    res.status(500).json({ message: "Failed to add facility." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});