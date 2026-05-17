// TO DO:
//  - Try/catch on api calls
//  - Security check in backend&frontend

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DataFile from "../assets/Excel web Asociacionestest.json"
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from "react-markdown"; // Para tunear el resultado de la IA de Gémini
import useLoading from "../hooks/useLoading"
// MUI
import {
    Box,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl, 
    FormLabel,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Toolbar, // en lugar de box usar Stack, que simplifica aún más la organización vertical.
    Tooltip,
    Typography,
} from '@mui/material';

// Esto es VITE y la variable de entorno se recupera así
const GEMINI_API_KEY = import.meta.env.VITE_APP_GEMINI_API_KEY 
const VITE_BACKEND_URL_RENDER = import.meta.env.VITE_BACKEND_URL_RENDER
const Chat3 = () => {
    const navigate = useNavigate();
    const [provincias, setProvincias] = useState([])
    const [selectedProvincia, setSelectedProvincia] = useState("")
    const [dialogOpen, setDialogOpen] = useState(true)

    const [input, setInput]= useState('')
    const [errorInput, setErrorInput] = useState(false)
    const [messages, setMessages] = useState([])
    // NO NEEDED API_KEY DUE TO ALREADY IN .ENV FILE 
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY }); 
    const bottomRef = useRef(null);
    const { setIsLoading, setWaitingMessageTextNumber, WaitingMessage } = useLoading()
    
    useEffect(()=> {
        const fetchingProvincias = async () => {
            setIsLoading(true)
            setWaitingMessageTextNumber(1)
            const response = await fetch(
                    // `http://localhost:5000/api/provincias`,
                    `${VITE_BACKEND_URL_RENDER}/api/provincias`,
                    {
                        method: 'GET',
                        headers: {
                            'Content-type': 'application/json; charset=UTF-8',
                        }
                    })
            const data = await response.json()
            const datosProvincias = data
            console.log("Provincias: ", datosProvincias)
            setProvincias(datosProvincias)
            setSelectedProvincia(datosProvincias[0].label)  // Seleccionamos la primera por defecto
            setIsLoading(false)
        }
        fetchingProvincias()
    }, [])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleDisconnect = () => {
        navigate(`/`);
    }

    const handleCloseDialog = () => {
        setDialogOpen(false)
    }


    const handleInput = (event) => {
        setInput(event.target.value)
    }

    const handleSend = (event) => {
        console.log("imprimo input: ", input)
        const checkError = input.trim() === ""
        if (checkError) {
            setErrorInput(true)
            setTimeout(() =>  {
                setInput("")
                setErrorInput(false)
            } , 2000)
            return
        }
        setErrorInput(false)

        const sentMessage = {
            color: "red", 
            backgroundColor: "#E0E0E0", 
            align: "right", 
            margin: "5px 0 0 50px", 
            padding: "10px", 
            borderRadius: "10px", 
            message: input
        }
        setMessages(prev=> [...prev, sentMessage])
        checkWithIA(input)
        setInput("")
    }

    const checkWithIA = async (inputMessage) => {
        setIsLoading(true)
        setWaitingMessageTextNumber(0)
        const response = await fetch( 
            // "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent",
            // "https://generativelanguage.googleapis.com/v1/models/gemini-3-flash-preview:generateContent", 
                // "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
                // "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=API_KEY",
                // "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
                // "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + GEMINI_API_KEY,

        // "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
        "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent",
            { 
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "x-goog-api-key": GEMINI_API_KEY 
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
                                        de las provincias más cercanas
                                        CONTEXTO: ${JSON.stringify(DataFile)} 
                                        INSTRUCCIÓN: Dime asociaciones u OGNs que me puedan ayudar.`
                                }
                            ]
                        } 
                    ] 
                })
            }
        )
        const data = await response.json()
        console.log("Respuesta Gemini: ", data)
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text
        const textProcessed = text.replace(/3\. \*\*/g, "\n3. **")
        console.log("Respuesta Gemini:", text);
        const repliedMessage = {
            color: "green", 
            backgroundColor: "#EDEEEE", 
            align: "left", 
            margin: "5px 0 0 0", 
            padding: "10px", 
            borderRadius: "10px", 
            message: `RESPUESTA: ${textProcessed}`
        }
        setMessages(prev=> [...prev, repliedMessage])
        setIsLoading(false)
    }

    const handleSetSelectedProvincia = (e) => {
        console.log("provincia seleccionada: ", e.target.value)
        setSelectedProvincia(e.target.value)
    }

    return (
        <Box component="form" noValidate autoComplete="off">
            <WaitingMessage />
            <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth>
                <DialogTitle>
                    <Stack spacing={1} > 
                        💬 Chat de ayuda a personas
                    </Stack>
                </DialogTitle>
                <DialogContent>
                    {/* los componentes se ponen por líneas (stack)*/}
                    <Stack spacing={1}
                        sx={{
                            overflowY: "auto",       // activa scroll vertical
                        }}
                    > 
                            {messages.map((message, index) => (
                                <div
                                    key={index}
                                    style={{
                                        color: message.color,
                                        backgroundColor: message.backgroundColor,
                                        textAlign: message.align,
                                        margin: message.margin,
                                        padding: message.padding,
                                        borderRadius: message.borderRadius
                                }}
                                >
                                    <ReactMarkdown
                                        components={{
                                            a: ({node, ...props}) => (
                                                <a
                                                    {...props}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                />
                                            )
                                        }}
                                    >
                                        {message.message}
                                    </ReactMarkdown>
                                </div>
                            ))}
                            {/* Este div invisible es la clave */}
                            <div ref={bottomRef} />
                    </Stack>

                </DialogContent>
                <DialogActions>
                    <Stack direction="column" spacing={1} sx={{ width: "100%" }}>  
                        {/* Puesto como ejemplo si hay más componentes en esta línea*/}
                        <Stack direction="row" spacing={2} sx={{ width: "100%" }}> 
                            <FormControl fullWidth margin='dense'>
                                {/*>Usuario *< */}
                                <TextField
                                    fullWidth
                                    id="mensaje"
                                    name="mensaje" // para evitar avisos en consola del navegador
                                    label="Escribe qué necesitas"
                                    placeholder=""
                                    value={input}
                                    required
                                    minRows={1}
                                    // variant="outlined"
                                    margin="normal"     // para que no se corte por la parte superior, pasa cuando está en un Dialog y TextField es el primero
                                    multiline
                                    error={errorInput}
                                    helperText={errorInput ? "El mensaje no puede estar vacío" : ""}
                                    onChange={handleInput}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault()
                                            console.log("Se pulsó Enter")
                                            handleSend()
                                        }
                                    }}
                                    >
                                </TextField>
                            </FormControl>
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ width: "100%" }}>  
                            <FormControl fullWidth margin='dense'>
                                {/* >Programa *<*/}
                                <InputLabel 
                                    id="provincia-label"
                                    // htmlFor="select-provincia"
                                    >
                                    Dime tu provincia
                                </InputLabel>
                                <Select
                                    labelId="provincia-label"
                                    id="provincia-select"
                                    name="provincia"
                                    label="Dime tu Provincia"
                                    value={selectedProvincia}
                                    onChange={handleSetSelectedProvincia}
                                    >
                                    {provincias.map((provincia,index) => (
                                        <MenuItem key={index} id={provincia.label} value={provincia.label}>{provincia.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {/* Enviar */}
                            <Button  onClick={handleSend} variant="contained">Enviar</Button>
                            {/* Cancelar */}
                            <Button onClick={() => { 
                                    setDialogOpen(false)
                                    handleDisconnect()
                                }}
                                color="error" variant="contained">Cancelar</Button>
                        </Stack>
                    </Stack>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default Chat3;