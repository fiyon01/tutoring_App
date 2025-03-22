const mysql = require ("mysql2/promise");
const dotenv = require ("dotenv");

// Load environment variables from .env file
dotenv.config();

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
db.getConnection()
    .then(connection => {
        console.log("Database connected successfully:", connection.threadId);
        connection.release(); // Always release the connection back to the pool
    })
    .catch(error => {
        console.error("Database connection error:", error);
    });

module.exports = db
