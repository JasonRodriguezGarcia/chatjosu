import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataFile from "../assets/Excel web Asociacionestest.json"
import { GoogleGenAI } from "@google/genai";
const GEMINI_API_KEY = import.meta.env.VITE_APP_GEMINI_API_KEY

function Chat1() {
    // const [connected, setConnected] = useState(true);
    const [input, setInput]= useState('')
    const [messages, setMessages] = useState([])
    const navigate = useNavigate();
    // console.log("gemini key: ", GEMINI_API_KEY)

    // const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_APP_GEMINI_API_KEY }); 
    // NO NEEDED API_KEY DUE TO ALREADY IN .ENV FILE 
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY }); 


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
        const sentMessage = {color: "red", align: "right", margin: "0 50px 0 0", message: input}
        setMessages(prev=> [...prev, sentMessage])
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
        console.log("Respuesta Gemini:", text);
        const repliedMessage = {color: "green", align: "left", margin: "0 0 0 50px", message: `replied: ${text}`}
        setMessages(prev=> [...prev, repliedMessage])

    }

    return (
        <div>
            <h2>💬 Chat Room</h2>
            <input type="text" onChange={handleInput} 
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        console.log("Se pulsó Enter")
                        handleSend()
                    }
                }}
            />
            {/* <input type="text" onChange={(event)=> setInput(event.target.value)}/> */}
            <button onClick={handleSend}>Send Mensaje</button>
                {messages.map((message, index) => (
                    <p  style={{color: message.color, textAlign: message.align, margin: message.margin}} 
                        key={index}>{message.message}
                    </p>
            ))}
        </div>
    )
}

export default Chat1;