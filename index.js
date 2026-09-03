const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:3000",
  process.env.CLIENT_URL,
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// MongoDB Client Setup with Serverless Connection Caching
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let dbInstance = null;

async function getDb() {
  if (dbInstance) return dbInstance;
  await client.connect();
  dbInstance = client.db("playplex");
  return dbInstance;
}

// Database Connection Middleware for Serverless
app.use(async (req, res, next) => {
  try {
    const db = await getDb();
    req.facilitiesCollection = db.collection("facilities");
    req.bookingsCollection = db.collection("bookings");
    next();
  } catch (error) {
    console.error("Database connection middleware error:", error);
    res.status(500).json({ message: "Database connection failed" });
  }
});

// Custom JWT Verification Middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret_key");
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Forbidden: Invalid or expired token" });
  }
};

// --- ROUTES (Registered Synchronously) ---

app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.post("/jwt", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required for token generation." });
    }

    const token = jwt.sign(
      { email },
      process.env.JWT_SECRET || "secret_key",
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true, 
      sameSite: "none", 
      maxAge: 7 * 24 * 60 * 60 * 1000, 
    });

    res.status(200).json({ success: true, message: "Token generated in cookie" });
  } catch (error) {
    console.error("Error issuing JWT:", error);
    res.status(500).json({ message: "Failed to generate authentication token" });
  }
});

app.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
  res.status(200).json({ success: true, message: "Logged out successfully" });
});

app.get("/facilities", async (req, res) => {
  try {
    const { search, type } = req.query;
    let query = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (type) {
      const typesArray = type.split(",");
      query.type = { $in: typesArray };
    }

    const facilities = await req.facilitiesCollection.find(query).toArray();
    res.json(facilities);
  } catch (error) {
    console.error("Error fetching facilities:", error);
    res.status(500).json({ message: "Failed to get facilities" });
  }
});

app.get("/my-facilities", verifyToken, async (req, res) => {
  try {
    const email = req.user.email;
    const query = { ownerEmail: email };
    const facilities = await req.facilitiesCollection.find(query).toArray();
    res.json(facilities);
  } catch (error) {
    console.error("Error fetching user facilities:", error);
    res.status(500).json({ message: "Failed to fetch facilities." });
  }
});

app.get("/facilities/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Facility ID format" });
    }

    const query = { _id: new ObjectId(id) };
    const facility = await req.facilitiesCollection.findOne(query);

    if (!facility) {
      return res.status(404).json({ message: "Facility not found" });
    }

    res.json(facility);
  } catch (error) {
    console.error("Error fetching single facility:", error);
    res.status(500).json({ message: "Failed to fetch facility details" });
  }
});

app.post("/facilities", verifyToken, async (req, res) => {
  try {
    const {
      name, type, image, location, price, pricePerHour, capacity, availableSlots, availableTimeSlots, description,
    } = req.body;

    const ownerEmail = req.user.email;
    const rate = pricePerHour || price;
    const slots = availableSlots || availableTimeSlots;

    if (!name || !rate) {
      return res.status(400).json({ message: "Required fields are missing." });
    }

    const newFacility = {
      name, type, image, location,
      price: parseFloat(rate),
      pricePerHour: parseFloat(rate),
      capacity: parseInt(capacity, 10),
      availableSlots: slots,
      availableTimeSlots: slots,
      description,
      ownerEmail,
      createdAt: new Date(),
    };

    const result = await req.facilitiesCollection.insertOne(newFacility);
    res.status(201).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error("Error inserting facility:", error);
    res.status(500).json({ message: "Failed to add facility." });
  }
});

app.put("/facilities/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Facility ID format" });
    }

    const { _id, ...updatedData } = req.body;

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
      $set: { ...updatedData, updatedAt: new Date() },
    };

    const result = await req.facilitiesCollection.updateOne(filter, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Facility not found" });
    }

    res.json({ success: true, message: "Facility updated successfully!" });
  } catch (error) {
    console.error("Error updating facility:", error);
    res.status(500).json({ message: "Failed to update facility." });
  }
});

app.delete("/facilities/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Facility ID format" });
    }

    const query = { _id: new ObjectId(id) };
    const result = await req.facilitiesCollection.deleteOne(query);

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Facility not found" });
    }

    res.json({ success: true, message: "Facility deleted successfully!" });
  } catch (error) {
    console.error("Error deleting facility:", error);
    res.status(500).json({ message: "Failed to delete facility." });
  }
});

app.get("/my-booking", verifyToken, async (req, res) => {
  try {
    const email = req.user.email;
    const query = {
      $or: [{ userEmail: email }, { email: email }],
    };

    const bookings = await req.bookingsCollection.find(query).toArray();
    res.json(bookings);
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    res.status(500).json({ message: "Failed to fetch bookings." });
  }
});

app.post("/my-booking", verifyToken, async (req, res) => {
  try {
    const bookingData = req.body;
    const userEmail = req.user.email;

    if (!bookingData.facilityId || !bookingData.bookingDate) {
      return res.status(400).json({ message: "Missing required booking fields." });
    }

    const newBooking = {
      ...bookingData,
      userEmail: userEmail,
      facilityId: ObjectId.isValid(bookingData.facilityId)
        ? new ObjectId(bookingData.facilityId)
        : bookingData.facilityId,
      status: bookingData.status || "confirmed",
      createdAt: new Date(),
    };

    const result = await req.bookingsCollection.insertOne(newBooking);

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

app.delete("/my-booking/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Booking ID format" });
    }

    const query = { _id: new ObjectId(id) };
    const result = await req.bookingsCollection.deleteOne(query);

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json({ success: true, message: "Booking cancelled successfully!" });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({ message: "Failed to cancel booking." });
  }
});

// Local development listener
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Export for Vercel Serverless Deployment
module.exports = app;