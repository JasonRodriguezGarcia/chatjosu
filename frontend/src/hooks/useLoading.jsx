import { useState } from "react";
import { Backdrop, CircularProgress } from "@mui/material";

const useLoading = () => {

    const [isLoading, setIsLoading] = useState(false)

    const WaitingMessage = () => {
        return (
            <Backdrop
                sx={(theme) => ({ color: '#fff', zIndex: theme.zIndex.drawer + 999 })}
                open={isLoading}
                >
                <CircularProgress color="inherit" />
                    <b>Waiting reply ... </b>
            </Backdrop>
        )
    }

    return {
        isLoading, setIsLoading, WaitingMessage
    }
}

export default useLoading