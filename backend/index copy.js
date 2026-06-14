import express from "express";
import path from "path";
import cors from 'cors';
import { fileURLToPath } from "url";
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS.split(',');
// Middleware
// para configurar cors
const corsOptions = { 
    origin: ALLOWED_ORIGINS
    // origin: "http://localhost:5173",
    // methods:["POST"] // sin esta línea se deja todos los methods
}
app.use(cors());
app.use(express.json());

// API Route Example
app.get("/api/message", (req, res) => {
  res.json({ message: "Hello from Express!" });
});

app.get('/api/provincias', async (req, res) => {
  try {
    const response = await fetch('https://datos.gob.es/apidata/nti/territory/Province?_pageSize=100&_sort=label');
    const data = await response.json();
    // console.log(data.result.items)
    res.json(data.result.items);
  } catch (err) {
    // console.log("Error: ", err.message)
    res.status(500).json({ error: 'Error al obtener provincias' });
  }
});

// **OPCIONAL**
// Serve React Frontend 
//app.use(express.static(path.join(__dirname, "../build")));

//app.get("*", (req, res) => {
//  res.sendFile(path.join(__dirname, "../build", "index.html"));
//});
// **END OPCIONAL**

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
