const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

dotenv.config();


const uri = process.env.MONGODB_URI || process.env.DB_URI;
const app = express();
const PORT = process.env.PORT || 5000;

app.set("trust proxy", 1);

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      process.env.CLIENT_URL,
      "https://playplex-client.vercel.app",
    ].filter(Boolean),
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db, facilitiesCollection, bookingsCollection, usersCollection;


async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db("playplex");
    facilitiesCollection = db.collection("facilities");
    bookingsCollection = db.collection("bookings");
    usersCollection = db.collection("users");
  }
}


app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("Database connection failed:", err);
    res.status(500).json({ error: "Database connection failed" });
  }
});

const sampleFacilities = [
  {
    name: "Apex 7v7 Football Arena",
    category: "Football",
    location: "North Sector, Dhanmondi",
    pricePerHour: 1800,
    rating: 4.9,
    image: "https://images.unsplash.com/photo-1529900245534-47fbf8204b61?auto=format&fit=crop&q=80&w=800",
    description: "FIFA-grade artificial grass with high-power LED floodlights and locker access.",
    createdAt: new Date(),
  },
  {
    name: "Grand Slam Badminton Hub",
    category: "Badminton",
    location: "Downtown Athletic Wing, Banani",
    pricePerHour: 1200,
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=800",
    description: "4 synthetic BWF-standard indoor courts with complete climate control.",
    createdAt: new Date(),
  },
  {
    name: "Vanguard Clay Tennis Courts",
    category: "Tennis",
    location: "East Hills Sports Club, Gulshan",
    pricePerHour: 2200,
    rating: 5.0,
    image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&q=80&w=800",
    description: "Red clay tournament surfaces with pro racket restringing services available.",
    createdAt: new Date(),
  },
  {
    name: "AquaSpeed Olympic Pool",
    category: "Swimming",
    location: "Central Aquatic Center, Mirpur",
    pricePerHour: 1500,
    rating: 4.7,
    image: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&q=80&w=800",
    description: "50-meter temperature-controlled lanes with certified lifeguards on duty.",
    createdAt: new Date(),
  },
  {
    name: "ProEdge Cricket Box Nets",
    category: "Cricket",
    location: "Westside Sports Park, Uttara",
    pricePerHour: 1600,
    rating: 4.9,
    image: "https://images.unsplash.com/photo-1531415074868-036b107e775a?auto=format&fit=crop&q=80&w=800",
    description: "Indoor turf nets featuring programmable automated bowling machines.",
    createdAt: new Date(),
  },
  {
    name: "Skyline Hardwood Basketball Gym",
    category: "Basketball",
    location: "Southbay Recreation Park, Bashundhara",
    pricePerHour: 1400,
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&q=80&w=800",
    description: "Full-size hardwood court with glass backboards and scoreboard system.",
    createdAt: new Date(),
  },
];

// ----------------------------------------------------
// JWT Verification Middleware
// ----------------------------------------------------
const verifyToken = (req, res, next) => {
  let token = req.cookies?.playplex_token;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || "playplex_jwt_secret"
    );
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token." });
  }
};

// Seed Route
app.get("/api/seed", async (req, res) => {
  try {
    const count = await facilitiesCollection.countDocuments();
    if (count === 0) {
      await facilitiesCollection.insertMany(sampleFacilities);
      return res.status(200).json({ message: "Seeded 6 facilities into MongoDB Atlas successfully!" });
    }
    res.status(200).json({ message: `Database already contains ${count} facilities.` });
  } catch (err) {
    console.error("Seed error:", err);
    res.status(500).json({ error: "Failed to seed database" });
  }
});

// Featured Facilities
app.get("/api/facilities/featured", async (req, res) => {
  try {
    const facilities = await facilitiesCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.status(200).json(facilities);
  } catch (err) {
    console.error("Error fetching featured facilities:", err);
    res.status(500).json({ error: "Failed to fetch featured facilities" });
  }
});

// All Facilities
app.get("/api/facilities", async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};

    if (search && search.trim()) {
      query.name = { $regex: search.trim(),$options: "i" };
    }

    if (category && category !== "All") {
      const categoryList = category
        .split(",")
        .map((cat) => new RegExp(`^${cat.trim()}$`, "i"));

      query.category = { $in: categoryList };
    }

    const facilities = await facilitiesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(facilities);
  } catch (error) {
    console.error("Error fetching facilities:", error);
    res.status(500).json({ error: "Failed to fetch facilities" });
  }
});

// Single Facility
app.get("/api/facilities/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const facility = await facilitiesCollection.findOne({ _id: new ObjectId(id) });
    if (!facility) {
      return res.status(404).json({ error: "Facility not found" });
    }
    res.status(200).json(facility);
  } catch (error) {
    console.error("Error fetching single facility:", error);
    res.status(500).json({ error: "Failed to fetch facility details" });
  }
});

// Create Facility
app.post("/api/facilities", verifyToken, async (req, res) => {
  try {
    const facilityData = req.body;

    const newFacility = {
      name: facilityData.name,
      category: facilityData.category,
      image: facilityData.image,
      location: facilityData.location,
      pricePerHour: Number(facilityData.pricePerHour),
      capacity: Number(facilityData.capacity),
      availableTimeSlots: facilityData.availableTimeSlots,
      description: facilityData.description,
      ownerEmail: req.user.email || facilityData.ownerEmail,
      rating: 5.0,
      createdAt: new Date(),
    };

    const result = await facilitiesCollection.insertOne(newFacility);
    res.status(201).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error("Error creating facility:", error);
    res.status(500).json({ error: "Failed to create facility" });
  }
});

// My Facilities
app.get("/api/my-facilities", verifyToken, async (req, res) => {
  try {
    const email = req.user.email || req.query.email;
    if (!email) {
      return res.status(400).json({ error: "Owner email is required" });
    }

    const facilities = await facilitiesCollection
      .find({ ownerEmail: email.toLowerCase() })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(facilities);
  } catch (error) {
    console.error("Error fetching my facilities:", error);
    res.status(500).json({ error: "Failed to fetch facilities" });
  }
});

// Update Facility
app.patch("/api/facilities/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { ownerEmail, ...updateData } = req.body;
    const requesterEmail = req.user.email || ownerEmail;

    if (!requesterEmail) {
      return res.status(401).json({ error: "Unauthorized. Owner email is required." });
    }

    const facility = await facilitiesCollection.findOne({ _id: new ObjectId(id) });
    if (!facility) {
      return res.status(404).json({ error: "Facility not found" });
    }

    if (facility.ownerEmail?.toLowerCase() !== requesterEmail.toLowerCase()) {
      return res.status(403).json({ error: "Forbidden: You are not the owner of this facility." });
    }

    if (updateData.pricePerHour) updateData.pricePerHour = Number(updateData.pricePerHour);
    if (updateData.capacity) updateData.capacity = Number(updateData.capacity);

    const result = await facilitiesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    res.status(200).json({ success: true, message: "Facility updated successfully", result });
  } catch (error) {
    console.error("Error updating facility:", error);
    res.status(500).json({ error: "Failed to update facility" });
  }
});

// Delete Facility
app.delete("/api/facilities/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const requesterEmail = req.user.email || req.query.email;

    if (!requesterEmail) {
      return res.status(401).json({ error: "Unauthorized. Owner email is required." });
    }

    const facility = await facilitiesCollection.findOne({ _id: new ObjectId(id) });
    if (!facility) {
      return res.status(404).json({ error: "Facility not found" });
    }

    if (facility.ownerEmail?.toLowerCase() !== requesterEmail.toLowerCase()) {
      return res.status(403).json({ error: "Forbidden: You cannot delete another user's facility." });
    }

    await facilitiesCollection.deleteOne({ _id: new ObjectId(id) });
    res.status(200).json({ success: true, message: "Facility deleted successfully" });
  } catch (error) {
    console.error("Error deleting facility:", error);
    res.status(500).json({ error: "Failed to delete facility" });
  }
});

// Create Booking
app.post("/api/bookings", verifyToken, async (req, res) => {
  try {
    const {
      facilityId,
      facilityName,
      userEmail,
      userName,
      bookingDate,
      timeSlot,
      hours,
      pricePerHour,
      totalPrice,
    } = req.body;

    if (!facilityId || !bookingDate || !timeSlot || !hours) {
      return res.status(400).json({ error: "Missing required booking details." });
    }

    const newBooking = {
      facilityId,
      facilityName,
      userEmail: req.user.email || userEmail,
      userName,
      bookingDate,
      timeSlot,
      hours: Number(hours),
      pricePerHour: Number(pricePerHour),
      totalPrice: Number(totalPrice),
      status: "pending",
      createdAt: new Date(),
    };

    const result = await bookingsCollection.insertOne(newBooking);
    res.status(201).json({ success: true, bookingId: result.insertedId });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// My Bookings
app.get("/api/my-bookings", verifyToken, async (req, res) => {
  try {
    const email = req.user.email || req.query.email;
    if (!email) {
      return res.status(400).json({ error: "User email is required" });
    }

    const bookings = await bookingsCollection
      .find({ userEmail: email.toLowerCase() })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Failed to load bookings" });
  }
});

// Cancel Booking
app.delete("/api/bookings/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const requesterEmail = req.user.email || req.query.email;

    const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.userEmail?.toLowerCase() !== requesterEmail?.toLowerCase()) {
      return res.status(403).json({ error: "Unauthorized to cancel this booking." });
    }

    await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
    res.status(200).json({ success: true, message: "Booking cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});

// Root Health Check
app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

// Export app for Vercel Serverless
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;