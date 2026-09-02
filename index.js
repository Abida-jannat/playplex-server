const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
let bookingsCollection;

async function run() {
  try {
    await client.connect();

    const db = client.db("playplex");

    facilitiesCollection = db.collection("facilities");
    bookingsCollection = db.collection("bookings");

    await client.db("admin").command({ ping: 1 });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

run();


app.get("/", (req, res) => {
  res.send("Server is running fine!");
});


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

// Fetch facilities added by a specific user (Query param: ?email=...)
app.get("/my-facilities", async (req, res) => {
  try {
    const email = req.query.email;

    if (!email) {
      return res.status(400).json({ message: "User email query parameter is required." });
    }

    const query = { ownerEmail: email };
    const facilities = await facilitiesCollection.find(query).toArray();

    res.json(facilities);
  } catch (error) {
    console.error("Error fetching user facilities:", error);
    res.status(500).json({ message: "Failed to fetch facilities." });
  }
});

// Fetch a single facility by ID
app.get("/facilities/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Facility ID format" });
    }

    const query = { _id: new ObjectId(id) };
    const facility = await facilitiesCollection.findOne(query);

    if (!facility) {
      return res.status(404).json({ message: "Facility not found" });
    }

    res.json(facility);
  } catch (error) {
    console.error("Error fetching single facility:", error);
    res.status(500).json({ message: "Failed to fetch facility details" });
  }
});

// Create a new facility entry
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

// Update an existing facility by ID
app.put("/facilities/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Facility ID format" });
    }

    const { _id, ...updatedData } = req.body;

    // Convert strings to numeric types for data consistency
    if (updatedData.pricePerHour || updatedData.price) {
      const priceVal = parseFloat(updatedData.pricePerHour || updatedData.price);
      updatedData.price = priceVal;
      updatedData.pricePerHour = priceVal;
    }

    if (updatedData.capacity) {
      updatedData.capacity = parseInt(updatedData.capacity, 10);
    }

    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        ...updatedData,
        updatedAt: new Date(),
      },
    };

    const result = await facilitiesCollection.updateOne(filter, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Facility not found" });
    }

    res.json({ success: true, message: "Facility updated successfully!" });
  } catch (error) {
    console.error("Error updating facility:", error);
    res.status(500).json({ message: "Failed to update facility." });
  }
});

// Delete a facility by ID
app.delete("/facilities/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Facility ID format" });
    }

    const query = { _id: new ObjectId(id) };
    const result = await facilitiesCollection.deleteOne(query);

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Facility not found" });
    }

    res.json({ success: true, message: "Facility deleted successfully!" });
  } catch (error) {
    console.error("Error deleting facility:", error);
    res.status(500).json({ message: "Failed to delete facility." });
  }
});

// Process user bookings
app.post("/bookings", async (req, res) => {
  try {
    const bookingData = req.body;


    if (
      !bookingData.facilityId ||
      !bookingData.bookingDate ||
      !bookingData.userEmail
    ) {
      return res.status(400).json({ message: "Missing required booking fields." });
    }


    const newBooking = {
      ...bookingData,
      facilityId: new ObjectId(bookingData.facilityId),
      createdAt: new Date(),
    };

    const result = await bookingsCollection.insertOne(newBooking);

    res.status(201).json({
      success: true,
      message: "Booking confirmed!",
      bookingId: result.insertedId,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ message: "Failed to process booking." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});