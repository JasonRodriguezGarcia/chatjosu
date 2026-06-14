import express from "express";
import path from "path";
import cors from 'cors';
import { fileURLToPath } from "url";
import { loadExcelContentData } from "./services/excel-service.js";
// import { tags } from "./data/tags.js";
import dotenv from 'dotenv';
dotenv.config();
import pool from './db-pg.js';

const SCHEMA_NAME = process.env.SCHEMA_NAME;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express(); 
const PORT = process.env.PORT || 5000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS.split(','); // devuelve un array tras separar con comas
app.locals.GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Genera una variable GLOBAL accesible desde cualquier lugar de la app

//
// functions
//
async function datos() {
    try {
        const result = await pool.query(`SELECT tag_id, descripcion FROM ${SCHEMA_NAME}.tags ORDER BY descripcion;`)
        
        console.log("Datos tags: result.rows")
        return result.rows

    } catch (err) {
        console.error('Error recuperando datos iniciales:', err.message);
        throw err;
        return { error: true }
    }
}

async function tagSaving(tagText) {
    console.log("tagText: ", tagText)
    tagText = tagText.replace("TAG: ", "").trim();
    console.log("tagtext: *",tagText, "*")
    const tag = tags.find((t, index) => {
            return t.descripcion === tagText
        })
    console.log("Tag encontrado: ", tag)

    // Saving tag in historic database
    const response = await pool.query(`
        INSERT INTO ${SCHEMA_NAME}.tags_historico
            (fecha, input_message, tag_id, user_id)
        VALUES (current_timestamp, 'TEST2-${tag.tag_id}', $1, 222)
        RETURNING tags_historico_id;
        `, [tag.tag_id]);
    // const data = await response.json();
    console.log("Tags historico creado: ", response.rows[0].tags_historico_id);

    return
}


const datosIniciales = await datos()
const tags = !datosIniciales ? [] : datosIniciales
console.log("datos tags: ", tags)

// Middleware

// Configurar cors
const corsOptions = { 
    origin: ALLOWED_ORIGINS
    // origin: "http://localhost:5173",
    // methods:["POST"] // sin esta línea se deja todos los methods
};

// Llama a la conversión del fichero excel de contexto y a la vez lo traduce a un objeto compatible Json
const excelContentData = await loadExcelContentData();
// app.locals es un objeto global asociado a la aplicación Express.
// Permite que cualquier ruta o middleware acceda a esos datos SIN VOLVER A LEER el Excel o ejecutar la funcion.
// Funcionaría también en res.app.locals.excelData para usarlo
app.locals.excelContentData = excelContentData;
// console.log ("ExcelData: ", excelContentData)

app.use(cors());
app.use(express.json());

// API Route Example
app.get("/api/message", (req, res) => {
  res.json({ message: "Hello from Express!" });
});

// '/api/provincias' es viejo anterior a chat4
// '/api/v1/helpchat/provincias' es nuevo
app.get(['/api/provincias', '/api/v1/helpchat/provincias'], async (req, res) => {
  try {
    const response = await fetch('https://datos.gob.es/apidata/nti/territory/Province?_pageSize=100&_sort=label');
    const data = await response.json();
    // console.log(data.result.items)
    res.json(data.result.items);
  } catch (err) {
    console.log("Error al obtener provincias: ", err.message);
    res.status(500).json({ error: 'Error al obtener provincias' });
  }
});

app.post('/api/v1/helpchat/iacall', async (req, res) => {

        const { inputMessage, selectedProvincia } = req.body;

        console.log("HA PASADO POR AQUI");
        let replyMessage = "";
        try {
            const response = await fetch( 
                // "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent",
                // "https://generativelanguage.googleapis.com/v1/models/gemini-3-flash-preview:generateContent", 
                    // "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + GEMINI_API_KEY,
            // "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
            "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent",
                { 
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "x-goog-api-key": app.locals.GEMINI_API_KEY 
                    },
                    body: JSON.stringify({
                        contents: [ 
                            { 
                                role: "user", 
                                parts: [ 
                                    { 
                                        text: `Eres un asistente que recomienda asociaciones de pacientes u ONG. Pregunto ${inputMessage}
                                            y los resultados que aparezcan serán para la provincia ${selectedProvincia} que en el caso de no
                                            tener resultados para esa provincia se dirá que no hay resultados pero se indicarán los resultados
                                            de las provincias más cercanas y devuelve el tag mas adecuado de los siguiente disponibles
                                            ${JSON.stringify(tags)} pero indicando el texto "#TAG: "+el tag oportuno+"#"
                                            CONTEXTO: ${JSON.stringify(app.locals.excelContentData)} 
                                            INSTRUCCIÓN: Dime asociaciones u OGNs que me puedan ayudar.`
                                    }
                                ]
                            } 
                        ] 
                    })
                }
            );
            const data = await response.json();
            console.log("Respuesta Gemini: ", data);
            replyMessage = data.candidates?.[0]?.content?.parts?.[0]?.text;

            const tagText = replyMessage.match(/#([^#]+)#/);
            const extraido = tagText ? tagText[1] : null;
            console.log("TAG devuelto: ", extraido);

            const textoSinTag = replyMessage.replace(/#[^#]+#/, "");

            // Guardando TAG en la base de datos

            await tagSaving(extraido);
            
            // res.json ({ message: textoSinTag, tag: tagExtraido });
            res.json ({ message: replyMessage });
        }
        catch (err) {
            console.log("Error al llamar a la IA: ", err.message);
            res.status(500).json({ error: 'Error al llamar a la IA' });

        }
})
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
