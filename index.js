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

// CORS configuration to allow credential exchange (cookies) with Next.js frontend
app.use(
  cors({
    origin: ["http://localhost:3000",
      "https://playplex-client.vercel.app"
   
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

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
   
    //await client.connect();

    const db = client.db("playplex");

    facilitiesCollection = db.collection("facilities");
    bookingsCollection = db.collection("bookings");

    //await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");


    app.get("/", (req, res) => {
      res.send("Server is running fine!");
    });

   

    // Generate Token and set HTTPOnly Cookie
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
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000, 
        });

        res.status(200).json({ success: true, message: "Token generated in cookie" });
      } catch (error) {
        console.error("Error issuing JWT:", error);
        res.status(500).json({ message: "Failed to generate authentication token" });
      }
    });

    // Clear Authentication Cookie (Logout)
    app.post("/logout", (req, res) => {
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      });
      res.status(200).json({ success: true, message: "Logged out successfully" });
    });

    

    // Fetch all available facilities with Search ($regex) & Filter ($in)
    app.get("/facilities", async (req, res) => {
      try {
        const { search, type } = req.query;
        let query = {};

        // Search by facility name using $regex (case-insensitive)
        if (search) {
          query.name = { $regex: search, $options: "i" };
        }

       
        if (type) {
          const typesArray = type.split(",");
          query.type = { $in: typesArray };
        }

        const facilities = await facilitiesCollection.find(query).toArray();
        res.json(facilities);
      } catch (error) {
        console.error("Error fetching facilities:", error);
        res.status(500).json({ message: "Failed to get facilities" });
      }
    });

    // Fetch facilities added by a specific user (Protected Route)
    app.get("/my-facilities", verifyToken, async (req, res) => {
      try {
        const email = req.user.email; // Extracted from verified JWT cookie

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

    // Create a new facility entry (Protected Route)
    app.post("/facilities", verifyToken, async (req, res) => {
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
        } = req.body;

        const ownerEmail = req.user.email;
        const rate = pricePerHour || price;
        const slots = availableSlots || availableTimeSlots;

        if (!name || !rate) {
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

    // Update an existing facility by ID (Protected Route)
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

    // Delete a facility by ID (Protected Route)
    app.delete("/facilities/:id", verifyToken, async (req, res) => {
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


    // Fetch bookings for the logged-in user (Protected Route)
    app.get("/my-booking", verifyToken, async (req, res) => {
      try {
        const email = req.user.email; // Extracted from verified JWT token

        const query = {
          $or: [{ userEmail: email }, { email: email }],
        };

        const bookings = await bookingsCollection.find(query).toArray();
        res.json(bookings);
      } catch (error) {
        console.error("Error fetching user bookings:", error);
        res.status(500).json({ message: "Failed to fetch bookings." });
      }
    });

    // Process user bookings (Protected Route)
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

    // Delete a booking by ID (Protected Route)
    app.delete("/my-booking/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid Booking ID format" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await bookingsCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Booking not found" });
        }

        res.json({ success: true, message: "Booking cancelled successfully!" });
      } catch (error) {
        console.error("Error cancelling booking:", error);
        res.status(500).json({ message: "Failed to cancel booking." });
      }
    });

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

run();