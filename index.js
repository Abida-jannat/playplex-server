const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"])

const express = require('express')
const dotenv = require('dotenv')
const { MongoClient, ServerApiVersion } = require('mongodb');

dotenv.config()

const uri = process.env.MONGODB_URI;

const app = express()

const PORT = process.env.PORT


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
  
      await client.connect();
      

      // Database reference for PlayPlex
      const db = client.db("playplex");
      const facilitiesCollection = db.collection("facilities");
      const bookingsCollection = db.collection("bookings");
 
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    
    await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("Server is running fine!")

})

app.listen(PORT, () => {
   console.log(`Server running on port ${PORT}`)
})