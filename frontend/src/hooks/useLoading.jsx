import { useState } from "react";
import { Backdrop, CircularProgress } from "@mui/material";

const useLoading = () => {

    const [isLoading, setIsLoading] = useState(false)
    const [waitingMessageTextNumber, setWaitingMessageTextNumber] = useState(0)
    const [waitingMessageText, setWaitingMessageText] = useState([
        "Esperando respuesta",
        "Cargando datos provincias"
    ])

    const WaitingMessage = () => {
        return (
            <Backdrop
                sx={(theme) => ({ color: '#fff', zIndex: theme.zIndex.drawer + 999 })}
                open={isLoading}
                >
                <CircularProgress color="inherit" />
                    {/* <b>Waiting reply ... </b> */}
                    <b>{waitingMessageText[waitingMessageTextNumber]} ... </b>
            </Backdrop>
        )
    }

    return {
        isLoading, setIsLoading, waitingMessageTextNumber, setWaitingMessageTextNumber, WaitingMessage
    }
}

export default useLoading