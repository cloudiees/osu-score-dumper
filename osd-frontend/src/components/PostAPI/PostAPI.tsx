import { useState, type FormEvent } from "react";

function PostAPI() {
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [result, setResult] = useState("");

    const sendAPIPostRequest = (e: FormEvent) => {
        e.preventDefault();
        console.log(`${clientId} + ${clientSecret}`);
        const data = {
            "client_id": clientId,
            "client_secret": clientSecret
        }
        setResult("LOADING");
        try {
            fetch("http://localhost:3001/set-api", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            })
                .then((resp) => {
                    resp.ok ? setResult("Good") : setResult("Bad");
                })
        } catch (err) {
            console.log("kill yourself");
        }
    }

    return (
        <>
            <form onSubmit={sendAPIPostRequest}>
                <label htmlFor="client-id-input">Client ID:</label>
                <input placeholder="Enter your client id here" id="client-id-input" required value={clientId} onChange={(e) => setClientId(e.target.value)} />
                <label htmlFor="client-secret-input">Client Secret:</label>
                <input placeholder="Enter your client secret here" id="client-secret-input" required value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
                <button type="submit">Submit</button>
            </form>
            <p>
                {result}
            </p>
        </>
    );
}

export default PostAPI;
