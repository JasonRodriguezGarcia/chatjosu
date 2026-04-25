import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DataFile from "../assets/Excel web Asociacionestest.json"
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from "react-markdown"; // Para tunear el resultado de la IA de Gémini
const GEMINI_API_KEY = import.meta.env.VITE_APP_GEMINI_API_KEY

function Chat2() {
    // const [connected, setConnected] = useState(true);
    const [input, setInput]= useState('')
    const [messages, setMessages] = useState([])
    const navigate = useNavigate();
    // console.log("gemini key: ", GEMINI_API_KEY)

    // const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_APP_GEMINI_API_KEY }); 
    // NO NEEDED API_KEY DUE TO ALREADY IN .ENV FILE 
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY }); 
    const bottomRef = useRef(null);
    const [provincias, setProvincias] = useState([])
    const [selectedProvincia, setSelectedProvincia] = useState("")

    useEffect(()=> {
        const fetchingProvincias = async () => {    
            const response = await fetch("http://datos.gob.es/apidata/nti/territory/Province?_pageSize=100&_sort=label")
            const data = await response.json()
            const datosProvincias = data.result.items
            console.log("Provincias: ", datosProvincias)
            setProvincias(datosProvincias)
            setSelectedProvincia(datosProvincias[0].label)  // Seleccionamos la primera por defecto
        }
        fetchingProvincias()
    }, [])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleDisconnect = () => {
        navigate(`/`);
    // socket.disconnect();
    // setConnected(false);
    }

    const handleInput = (event) => {
        setInput(event.target.value)
        // console.log ("input: ", event.target.value)
    }

    const handleSend = (event) => {
        console.log("imprimo input: ", input)
        const sentMessage = {color: "red", backgroundColor: "#E0E0E0", align: "right", margin: "50px", padding: "10px", borderRadius: "10px", message: input}
        setMessages(prev=> [...prev, sentMessage])
        setInput('')
        // const repliedMessage = {color: "green", align: "left", margin: "0 0 0 50px", message: `replied: ${input}`}
        // setMessages(prev=> [...prev, repliedMessage])
        checkWithIA(input)
    }

    const checkWithIA = async (inputMessage) => {
        // SIMPLE EXAMPLE USING GOOGLE SDK
        // const response = await ai.models.generateContent({
        //     model: "gemini-3-flash-preview",
        //     // model: "gemini-1.5-flash",
        //     // model: "gemini-2.5-flash",
        //     // contents: `You can check if the following text is grammatically correct: ${selectedDescription.description}`,
        //     contents: "Explain how AI works in a few words",
        //     // contents: [ 
        //     //     { 
        //     //         role: "user", 
        //     //         parts: [ 
        //     //             { 
        //     //                 // text: `eres un profesional de la salud y ongs. Informa al usuario de como contactar con la ong más adecuada
        //     //                 text: `Eres un asistente que recomienda asociaciones de pacientes u ONG. Pregunto ${inputMessage}
        //     //                     CONTEXTO: ${JSON.stringify(DataFile)} 
        //     //                     INSTRUCCIÓN: Dime asociaciones u OGNs que me puedan ayudar.`
        //     //             }
        //     //         ]
        //     //     } 
        //     // ] 

        // });
        // console.log("Respuesta: ", response)
        // let geminiMessage = {message: response.text, role: "bot"}
        // // setResponses(prevResponses => [...prevResponses, geminiMessage])
        // console.log(response.text);
        // // const processedMessage = geminiMessage.message.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        // setMessage(geminiMessage.message)
        // // setMessage(processedMessage)

        // MORE COMPLICATE EXAMPLE BUT MORE POWERFULL
        // - NO LIBRARIES DEPENDENCY
        // - MORE CONTROL ON FETCHING
        //      GET → pedir datos (sin cuerpo)
        //      POST → enviar datos para que el servidor haga algo (como generar texto)
            console.log("gemini key: ", GEMINI_API_KEY)

        const response = await fetch( 
            // "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent",
            // "https://generativelanguage.googleapis.com/v1/models/gemini-3-flash-preview:generateContent", 
                // "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
                // "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=API_KEY",
                // "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
                // "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + GEMINI_API_KEY,
                // "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent",
                // "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent",
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
            { 
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    // "Authorization": `Bearer ${GEMINI_API_KEY}` },
                    "x-goog-api-key": GEMINI_API_KEY 
                },
                body: JSON.stringify({
                    contents: [ 
                        { 
                            role: "user", 
                            parts: [ 
                                { 
                                    // text: `eres un profesional de la salud y ongs. Informa al usuario de como contactar con la ong más adecuada
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
        // REPLY STRUCTURE IS
        // {
        // "candidates": [
        //     {
        //     "content": {
        //         "parts": [
        //         {
        //             "text": "Aquí está la respuesta del modelo..."
        //         }
        //         ]
        //     }
        //     }
        // ]
        // }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const textProcessed = text.replace(/3\. \*\*/g, "\n3. **")
        console.log("Respuesta Gemini:", text);
        const repliedMessage = {color: "green", backgroundColor: "#EDEEEE", align: "left", margin: "0 0 0 50px", padding: "10px", borderRadius: "10px", message: `RESPUESTA: ${text}`}
        setMessages(prev=> [...prev, repliedMessage])
    }

    const optionProvincias = () => {
        return provincias.map((provincia, index) => (
            <option key={index} id={provincia.label} value={provincia.label}>{provincia.label}</option>
        ))
    }

    return (
        // <div style={{width: "100vw"}}>
        <div style={{backgroundColor: "#F9FAFB",
            width: "80%",
            height: "90vh",          // altura fija relativa a la pantalla

        }}>
            <h2>💬 Chat Room</h2>
            <label name="selectProvincias" id="selectProvincias">Provincia: </label>
            <select name="selectProvincias" id="selecProvincias" onChange={(e)=> setSelectedProvincia(e.target.value)}>
                {optionProvincias()}
            </select>
            <br />
            <label htmlFor="mensaje">Mensaje: </label>
            <input 
                id="mensaje"
                type="text"
                value={input}
                onChange={handleInput}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        console.log("Se pulsó Enter")
                        handleSend()
                    }
                }}
            />
            <br />
            {/* <input type="text" onChange={(event)=> setInput(event.target.value)}/> */}
            <button onClick={handleSend}>Send Mensaje</button>
            {/* <div style={{width: "80%", heigth: "80%", scroll: "auto", margin: "auto", border: "1px solid"}}> */}
            <div style={{
                width: "80%",
                height: "70%",
                // height: "70vh",          // altura fija relativa a la pantalla
                // heigth: "100%",
                overflowY: "auto",       // activa scroll vertical
                margin: "auto",
                border: "1px solid",
                display: "flex",
                flexDirection: "column"

            }}>
                {messages.map((message, index) => (
                    // <p  style={{color: message.color, textAlign: message.align, margin: message.margin}} 
                    // key={index}>{message.message}
                    // </p>
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
                        <ReactMarkdown>
                            {message.message}
                        </ReactMarkdown>
                    </div>
                ))}
                {/* Este div invisible es la clave */}
                <div ref={bottomRef} />
            </div>
        </div>
    )
}

export default Chat2;