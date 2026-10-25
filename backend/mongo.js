require('dotenv').config();

const { MongoClient } = require('mongodb');

const uri =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';

const databaseName =
  process.env.MONGODB_DB || 'clinical_analytics';

const client = new MongoClient(uri);

let databasePromise;

async function getMongoDb() {
  if (!databasePromise) {
    databasePromise = client
      .connect()
      .then(() => client.db(databaseName))
      .catch((error) => {
        databasePromise = null;
        throw error;
      });
  }

  return databasePromise;
}

module.exports = {
  getMongoDb,
  client
};
