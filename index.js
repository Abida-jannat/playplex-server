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

// Middlewares
app.use(cors());
app.use(express.json());

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

    // Ping check
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

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