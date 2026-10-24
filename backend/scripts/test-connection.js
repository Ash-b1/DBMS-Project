require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'clinical_decision_support'
    });

    const [rows] = await connection.query(
      'SELECT DATABASE() AS database_name, VERSION() AS mysql_version'
    );

    console.log('MySQL connection successful!');
    console.log(rows[0]);
  } catch (error) {
    console.error('MySQL connection failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

main();
