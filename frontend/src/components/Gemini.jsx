import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import styles from "./Gemini.module.css";
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import SendIcon from '@mui/icons-material/Send';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { useTheme } from '@emotion/react';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
// import theme from '../../theme';


// darse de alta en Google Ai studio
// https://aistudio.google.com/apikey

// cogemos el apikey del .env file REACT_APP_GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.REACT_APP_GEMINI_API_KEY }); 

const Gemini = ()=> {

    const [message, setMessage] = useState("")
    const [responses, setResponses] = useState([])
    const [isLoading, setIsLoading] = useState(false)

    const theme = useTheme() // use theme

    const handleMessage = async ()=> {
        console.log("mandar mensaje !!")
        let userMessage = {message: message, role: "user"}
        setResponses(prevResponses => [...prevResponses, userMessage])
        console.log(responses)
        setIsLoading(true)
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: message,
          });
        let geminiMessage = {message: response.text, role: "bot"}
        setResponses(prevResponses => [...prevResponses, geminiMessage])
        console.log(response.text);
        setIsLoading(false)
        setMessage("")
    }

    return (
        <div className={styles.gemini}>
            {/* <h1>GEMINEITOR</h1> */}
            {/* <Typography variant="h1">GEMINEITOR</Typography> */}
            {/* usando theme */}
            <Typography variant="h1" sx={{backgroundColor: theme.palette.secondary.main}}>GEMINEITOR</Typography> 
            {/* <Typography variant="h3">Gemini's terminador</Typography> // no funcionaría por Gemini's*/}
            <Typography variant="h3">Gemini&apos;s Chat</Typography>

            <Box sx={{ p: 2, border: '1px dashed grey' }}>
                <ul>
                    {responses.map((response, index) => (
                        <li key={index} 
                        className={response.role === "bot"? styles.bot : styles.user}
                        >
                            {response.message}
                        </li>
                    ))}
                </ul>
            </Box>

            {/* <input type="text" placeholder='Introduce pregunta'
                id="message" name="message"
                onChange={(e)=> setMessage(e.target.value)}
            /> */}
            {/* <button onClick={handleMessage}>Enviar</button> */}

            <div className={styles.sendingBox}>
                {/* <TextField id="outlined-basic" label="Outlined" variant="outlined" />
                <TextField id="filled-basic" label="Filled" variant="filled" /> */}
                <TextField label='Introduce pregunta' variant="standard"
                        id="message" name="message"
                        onChange={(e)=> setMessage(e.target.value)}
                        sx={{width: "80%"}} // usando MUI
                        />

                {isLoading && (<CircularProgress />)}
                {/* <Button variant="text">Text</Button> */}
                {!isLoading && 
                    <Button variant="contained"
                        color="primary" // para poner el color primario
                        // color="secondary" // para poner el color secundario
                        size="small" // tamaño
                        onClick={handleMessage}
                        endIcon={<SendIcon />}
                        sx={{width: "20%"}} // usando atributos MUI
                    >
                        Enviar
                    </Button>
                }

                {/* <Button variant="outlined">Outlined</Button> */}
            </div>

            <Grid container spacing={2} sx={{ padding: '20px' }}>
                <Grid item xs={12} sm={6} md={4}>
                    <Paper sx={{ padding: '20px', height: '100%' }}>
                    <Typography variant="h6">Item 1</Typography>
                    <Typography>Content for Item 1</Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <Paper sx={{ padding: '20px', height: '100%' }}>
                    <Typography variant="h6">Item 2</Typography>
                    <Typography>Content for Item 2</Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <Paper sx={{ padding: '20px', height: '100%' }}>
                    <Typography variant="h6">Item 3</Typography>
                    <Typography>Content for Item 3</Typography>
                    </Paper>
                </Grid>
            </Grid>

        </div>
    )
}

export default Gemini;