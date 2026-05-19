import mysql from 'mysql2';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_ROOT_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'epytodo',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Export a promise-based pool for convenient async/await usage
import { promisify } from 'util';
const promisePool = pool.promise();

export default promisePool;
