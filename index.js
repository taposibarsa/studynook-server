const express = require('express');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion } = require('mongodb');

dotenv.config();

const app = express();

const port = process.env.PORT || 5000;

const uri = process.env.MONGODB_URI;

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

    await client.db("admin").command({ ping: 1 });

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.log(error);
  }
}

run();

app.get('/', (req, res) => {
  res.send('Server is running fine');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});