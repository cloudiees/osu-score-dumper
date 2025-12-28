import { useEffect, useRef, useState } from "react";
import PostAPI from "./components/PostAPI/PostAPI";
import PostUser from "./components/PostUser/PostUser";
import Dumper from "./components/Dumper/Dumper";

function App() {
  const socketRef = useRef<WebSocket | null>(null);
  const [apiStatus, setApiStatus] = useState(true);
  const [userStatus, setUserStatus] = useState(true);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3001");
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("connected!");
      socket.send("living I am");
    };

    socket.onmessage = (msg) => {
      console.log("server said:", msg.data);
    };

    socket.onclose = () => {
      console.log("socket closed");
    };

    return () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    fetch("http://localhost:3001/info", {
      method: "GET"
    }).then((res) => {
      console.log(res);
      if (res.status == 251 || res.status == 253) setApiStatus(true);
      else setApiStatus(false);
      if (res.status == 252 || res.status == 253) setUserStatus(true);
      else setUserStatus(false);
    });
  }, []);

  const sendMsg = () => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send("uwu");
  };

  const cancel = () => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send("cancel");
  };


  return (
    <>
      <button onClick={sendMsg}>Send msg to server</button>
      <button onClick={cancel}>Send cancel</button>
      {apiStatus ? null : (<PostAPI />)}
      {userStatus ? null : (<PostUser />)}
      {apiStatus && userStatus ? (<Dumper />) : null}
    </>
  );
}

export default App;
