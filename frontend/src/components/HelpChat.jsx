import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from "react-markdown";     // Para tunear el resultado de la IA de Gémini
import useLoading from "../hooks/useLoading"    // Para la pantalla de Cargando
// MUI
import {
    Box,
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Toolbar, // en lugar de box usar Stack, que simplifica aún más la organización vertical.
    Typography,
} from '@mui/material';

const HelpChat = () => {
    const [provincias, setProvincias] = useState([])
    const [selectedProvincia, setSelectedProvincia] = useState("")

    const [input, setInput]= useState('')
    const [errorInput, setErrorInput] = useState(false)
    const [messages, setMessages] = useState([])
    const bottomRef = useRef(null);
    const { setIsLoading, setWaitingMessageTextNumber, WaitingMessage } = useLoading()

    useEffect(()=> {
        const fetchingProvincias = async () => {
            setIsLoading(true)
            setWaitingMessageTextNumber(1)
            try {

                const response = await fetch(
                    // `http://localhost:5000/api/provincias`,
                    "/api/v1/helpchat/provincias",
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
                }
            catch (err) {
                console.log("Error al obtener provincias: ", err.message)
            }

            setIsLoading(false)
        }
        fetchingProvincias()
    }, [])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

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
        checkWithIA(input, selectedProvincia)
        setInput("")
    }

    const checkWithIA = async (inputMessage, selectedProvincia) => {
        setIsLoading(true)
        setWaitingMessageTextNumber(0)
        const iaQueryData = {
            inputMessage,
            selectedProvincia
        }

        let text = ""
        try {

            const response = await fetch(
                "/api/v1/helpchat/iacall",
                {
                    method: 'POST',
                    headers: {
                        'Content-type': 'application/json; charset=UTF-8',
                    },
                    body: JSON.stringify(iaQueryData)
                }
            )
            const data = await response.json()
            console.log("Respuesta backend: ", data)
            text = data.message
        }
        catch (err) {
            console.log("Error al llama a /helpchat/iacall: ", err.message)
        }
        const textProcessed = text.replace(/3\. \*\*/g, "\n3. **")
        console.log("Respuesta backend:", text);
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
        <Box
            component="form"
            noValidate
            autoComplete="off"
            sx={{
                height: "100dvh",
                display: "flex",
                flexDirection: "column",
                bgcolor: "background.default",
                overflow: "hidden",
            }}
        >
            <WaitingMessage />

            <Toolbar
                sx={{
                    borderBottom: 1,
                    borderColor: "divider",
                    bgcolor: "background.paper",
                    gap: 1.5,
                    px: { xs: 1.5, sm: 2 },
                    minHeight: { xs: 64, sm: 68 },
                }}
            >
                <Typography
                    variant="h6"
                    component="div"
                    sx={{
                        flexGrow: 1,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                    }}
                >
                    Copilot ONG
                </Typography>

                <FormControl size="small" sx={{ minWidth: { xs: 118, sm: 160 } }}>
                    <InputLabel id="provincia-label">Provincia</InputLabel>
                    <Select
                        labelId="provincia-label"
                        id="provincia-select"
                        name="provincia"
                        label="Provincia"
                        value={selectedProvincia}
                        onChange={handleSetSelectedProvincia}
                    >
                        {provincias.map((provincia, index) => (
                            <MenuItem
                                key={index}
                                id={provincia.label}
                                value={provincia.label}
                            >
                                {provincia.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

            </Toolbar>

            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    px: { xs: 1.5, sm: 2 },
                    py: 2,
                }}
            >
                <Box
                    sx={{
                        width: "100%",
                        maxWidth: 800,
                        mx: "auto",
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
                                borderRadius: message.borderRadius,
                            }}
                        >
                            <ReactMarkdown
                                components={{
                                    a: ({ node, ...props }) => (
                                        <a
                                            {...props}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        />
                                    ),
                                }}
                            >
                                {message.message}
                            </ReactMarkdown>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </Box>
            </Box>

            <Box
                sx={{
                    borderTop: 1,
                    borderColor: "divider",
                    bgcolor: "background.paper",
                    px: { xs: 1.5, sm: 2 },
                    py: 1.5,
                }}
            >
                <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="flex-start"
                    sx={{
                        width: "100%",
                        maxWidth: 800,
                        mx: "auto",
                    }}
                >
                    <TextField
                        fullWidth
                        id="mensaje"
                        name="mensaje"
                        label="Escribe qué necesitas"
                        value={input}
                        required
                        minRows={1}
                        maxRows={5}
                        multiline
                        error={errorInput}
                        helperText={errorInput ? "El mensaje no puede estar vacío" : ""}
                        onChange={handleInput}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault()
                                handleSend()
                            }
                        }}
                    />
                    <Button
                        onClick={handleSend}
                        variant="contained"
                        sx={{ minHeight: 56, px: { xs: 2, sm: 3 } }}
                    >
                        Enviar
                    </Button>
                </Stack>
            </Box>
        </Box>
    )
}

export default HelpChat;
