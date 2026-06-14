import Chat4 from "../components/Chat4";

const ChatJosuPage4 = () => {

    return (
        <div style = {{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", margin: 0, border: "1px solid black"}}>
            <h2>Welcome to CHAT4 (
                backend al arrancar lee el excel con el contexto y lo pasa a Json (objeto),
                frontend llama a backend pasandole el prompt+provincia, 
                backend los usa junto con el contexto en su llamada a Gemini IA que devuelve resultados+TAG)
            </h2>
            <Chat4 />
        </div>
    );
}
export default ChatJosuPage4;