const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

dotenv.config();

const uri = process.env.MONGODB_URI;
const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(
  cors({
    origin: "http://localhost:3000",
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

async function run() {
  try {
    await client.connect();

    // Database and collections
    const db = client.db("playplex");
    const facilitiesCollection = db.collection("facilities");
    const bookingsCollection = db.collection("bookings");
    const usersCollection = db.collection("users");

    // Ping check
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

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

    // Endpoint to generate & store JWT in HTTPOnly cookie (Call this after Better-Auth login)
    app.post("/api/auth/jwt-token", async (req, res) => {
      try {
        const { email } = req.body;
        if (!email) {
          return res.status(400).json({ error: "Email is required" });
        }

        const token = jwt.sign(
          { email: email.toLowerCase() },
          process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || "playplex_jwt_secret",
          { expiresIn: "7d" }
        );

        res.cookie("playplex_token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(200).json({ success: true, message: "Token cookie set successfully" });
      } catch (error) {
        console.error("JWT creation error:", error);
        res.status(500).json({ error: "Failed to generate token" });
      }
    });

    // Endpoint to clear HTTPOnly cookie on logout
    app.post("/api/auth/logout", (req, res) => {
      res.clearCookie("playplex_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      });
      res.status(200).json({ success: true, message: "Logged out successfully" });
    });

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

    // 1. User Registration Route
    app.post("/api/auth/register", async (req, res) => {
      try {
        const { name, email, photoURL, password } = req.body;

        if (!name || !email || !password) {
          return res.status(400).json({ error: "Name, email, and password are required." });
        }

        const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
        if (existingUser) {
          return res.status(409).json({ error: "Email already registered. Please login." });
        }

        const newUser = {
          name,
          email: email.toLowerCase(),
          photoURL: photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
          password,
          role: "user",
          createdAt: new Date(),
        };

        await usersCollection.insertOne(newUser);
        res.status(201).json({ message: "User registered successfully!" });
      } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ error: "Internal server error during registration." });
      }
    });

    // 2. User Login Route
    app.post("/api/auth/login", async (req, res) => {
      try {
        const { email, password } = req.body;

        if (!email || !password) {
          return res.status(400).json({ error: "Email and password are required." });
        }

        const user = await usersCollection.findOne({ email: email.toLowerCase() });

        if (!user || user.password !== password) {
          return res.status(401).json({ error: "Invalid email or password." });
        }

        // Generate token and set HTTPOnly cookie
        const token = jwt.sign(
          { id: user._id, email: user.email, role: user.role || "user" },
          process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || "playplex_jwt_secret",
          { expiresIn: "7d" }
        );

        res.cookie("playplex_token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(200).json({
          message: "Login successful!",
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            photoURL: user.photoURL,
            role: user.role,
          },
        });
      } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error during login." });
      }
    });

    // 3. Google Sign-in / Social Login Route
    app.post("/api/auth/google", async (req, res) => {
      try {
        const { name, email, photoURL } = req.body;

        if (!email) {
          return res.status(400).json({ error: "Email is required for Google authentication." });
        }

        let user = await usersCollection.findOne({ email: email.toLowerCase() });

        if (!user) {
          const newUser = {
            name: name || "PlayPlex Athlete",
            email: email.toLowerCase(),
            photoURL: photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
            provider: "google",
            role: "user",
            createdAt: new Date(),
          };
          const result = await usersCollection.insertOne(newUser);
          user = { ...newUser, _id: result.insertedId };
        }

        // Generate token and set HTTPOnly cookie
        const token = jwt.sign(
          { id: user._id, email: user.email, role: user.role || "user" },
          process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || "playplex_jwt_secret",
          { expiresIn: "7d" }
        );

        res.cookie("playplex_token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(200).json({
          message: "Google authentication successful!",
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            photoURL: user.photoURL,
            role: user.role,
          },
        });
      } catch (error) {
        console.error("Google auth error:", error);
        res.status(500).json({ error: "Internal server error during Google sign-in." });
      }
    });

    // POST: Create New Facility (Protected by verifyToken)
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

    // READ: Get All Facilities (supports search with $regex & filter with$in)
    app.get("/api/facilities", async (req, res) => {
      try {
        const { category, search } = req.query;
        let query = {};

        // 1. Search by facility name using $regex
        if (search && search.trim()) {
          query.name = { $regex: search.trim(),$options: "i" };
        }

        // 2. Filter by sport type using $in
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
    
    // GET: Single Facility by ID
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

    // POST: Create New Booking (Protected by verifyToken)
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

    // GET: Facilities for logged-in owner (Protected by verifyToken)
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

    // UPDATE: Update facility (Only owner can update - Protected by verifyToken)
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

    // DELETE: Delete facility (Only owner can delete - Protected by verifyToken)
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

    // GET: Logged-in user's bookings (Protected by verifyToken)
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

    // DELETE: Cancel Booking (Protected by verifyToken)
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

  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});