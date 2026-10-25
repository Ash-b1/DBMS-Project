const { getMongoDb, client } = require('../mongo');

async function main() {
  try {
    const db = await getMongoDb();
    const result = await db.command({ ping: 1 });

    console.log('MongoDB connection successful.');
    console.log('Database:', db.databaseName);
    console.log('Ping result:', result.ok);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();
