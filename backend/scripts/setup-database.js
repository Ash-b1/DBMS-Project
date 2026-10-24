require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const dbName = process.env.DB_NAME || 'clinical_decision_support';
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });

    await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);

    const files = ['01_create_database.sql', '02_schema.sql', '03_seed.sql'];
    for (const file of files) {
      const sql = fs.readFileSync(path.join(__dirname, '..', 'database', file), 'utf8');
      await connection.query(sql);
      console.log('Ran ' + file);
    }
    console.log('Database setup complete.');
  } catch (error) {
    console.error('Database setup failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

main();
