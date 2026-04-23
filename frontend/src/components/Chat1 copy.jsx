import React, { useEffect, useState } from 'react';
// import { io } from 'socket.io-client';

// const socket = io('http://localhost:5000'); // Connect once

function Chat1() {
    const [connected, setConnected] = useState(true);
    const [input, setInput]= useState('')
    const [messages, setMessages] = useState([])

//   useEffect(() => {
//     socket.on('connection', () => {
//         console.log('Connected to socket');
//         setConnected(true);
//       });
//     socket.on('chatReply', (data) => {
//         console.log(data);
//         setMessages(prev=> [...prev, data])
    
//     });
    
//     socket.on('disconnect', (reason) => {
//       console.log('Disconnected from socket');
//       setConnected(false);
//     });

//     return () => {
//       socket.off('connect');
//       socket.off('disconnect');
//       socket.off('chatReply');
//     };
//   }, []);

  const handleDisconnect = () => {
    // socket.disconnect();
    // setConnected(false);
  };

  const handleSend = (event) => {
    console.log("imprimo input: ", input)
    const sentMessage = {color: "red", message: input}
    setMessages(prev=> [...prev, sentMessage])
    const repliedMessage = {color: "green", message: input}
    setMessages(prev=> [...prev, repliedMessage])
  }

  return (
    <div>
      <h2>💬 Chat Room</h2>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      {connected && (
          <button onClick={handleDisconnect}>Disconnect</button>
        )}
      <input type="text" onChange={(event)=> setInput(event.target.value)}/>
      {/* <input type="text" onChange={(event)=> setInput(event.target.value)}/> */}
      <button onClick={handleSend}>Send Mensaje</button>
        {messages.map((message, index) => (
            <p style={{color: message.color}} key={index}>{message.message}</p>
        ))}
    </div>
  );
}

export default Chat1;