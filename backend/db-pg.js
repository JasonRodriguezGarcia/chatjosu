import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pkg;


// Recuperando detalles de la BBDD
const DATABASE_DETAILS = JSON.parse(process.env.DATABASE_DETAILS)

const pool = new Pool({
  user: DATABASE_DETAILS.DATABASE_USER,
  host: DATABASE_DETAILS.DATABASE_HOST,
  database: DATABASE_DETAILS.DATABASE_DATABASE,
  password: DATABASE_DETAILS.DATABASE_PASSWORD,
  port: process.env.DATABASE_PORT,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,                  // Opcional: conexiones (peticiones simultáneas) máximas a la base de datos
  idleTimeoutMillis: 30000  // Opcional: cerrar conexiones inactivas a los X segundos
});

export default pool;


// https://node-postgres.com