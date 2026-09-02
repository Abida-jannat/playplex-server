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
    // 1. Connect database client
    await client.connect();

    const db = client.db("playplex");

    facilitiesCollection = db.collection("facilities");
    bookingsCollection = db.collection("bookings");

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // 2. Health Check Route
    app.get("/", (req, res) => {
      res.send("Server is running fine!");
    });

    // --- FACILITIES ENDPOINTS ---

    // Fetch all available facilities
    app.get("/facilities", async (req, res) => {
      try {
        const facilities = await facilitiesCollection.find().toArray();
        res.json(facilities);
      } catch (error) {
        console.error("Error fetching facilities:", error);
        res.status(500).json({ message: "Failed to get facilities" });
      }
    });

    // Fetch facilities added by a specific user
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

  

    // Fetch bookings for the logged-in user 
    app.get(["/my-booking", "/my-booking"], async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).json({ message: "User email query parameter is required." });
        }

       
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

    // Process user bookings 
    
    app.post(["/my-booking", "/my-booking"], async (req, res) => {
      try {
        const bookingData = req.body;
        const userEmail = bookingData.userEmail || bookingData.email;

        if (
          !bookingData.facilityId ||
          !bookingData.bookingDate ||
          !userEmail
        ) {
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

    
    app.delete(["/my-booking/:id", "/my-booking/:id"], async (req, res) => {
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