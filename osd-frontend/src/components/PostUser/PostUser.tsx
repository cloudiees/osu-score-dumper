import { useState, type FormEvent } from "react";

function PostUser() {
    const [user, setUser] = useState("");
    const [result, setResult] = useState("");

    const sendUserPostRequest = (e: FormEvent) => {
        e.preventDefault();
        console.log(`${user}`);
        const data = {
            "user": user,
        }
        setResult("LOADING");
        try {
            fetch("http://localhost:3001/set-user", {
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
            <form onSubmit={sendUserPostRequest}>
                <label htmlFor="user-input">User:</label>
                <input placeholder="Enter your user here" id="user-input" required value={user} onChange={(e) => setUser(e.target.value)} />
                <button type="submit">Submit</button>
            </form>
            <p>
                {result}
            </p>
        </>
    );
}

export default PostUser;
