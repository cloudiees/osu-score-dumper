import express, { Request, Response } from "express";
import cors from "cors";
import * as osu from "osu-api-v2-js";
import "dotenv/config";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import wait from "./utils/wait";
import WebSocketWithFlags from "./interfaces/flaggedWS";
import { setEnv, readEnv } from "./utils/envUtils";
import { dumpAllScores } from "./utils/dumping";
import { UserObject } from "./interfaces/dbInterfaces";
import { OsuDatabase } from "./database";

export const app = express();
app.use(cors());
app.use(express.json());
const server = createServer(app);
const wss = new WebSocketServer({ server });
let delay = 100;
let priamryWebSocket: WebSocketWithFlags | null = null;

let userInfo: UserObject = { osuId: -1, osuName: "" };
let osuApi: osu.API | null = null;

const database: OsuDatabase = OsuDatabase.getInstance();


async function test(wswf: WebSocketWithFlags) {
    for (let i = 0; i < 1000000; i++) {
        // console.log(wswf.isCancelled);
        if (wswf.isCancelled) break;
        if (wswf.ws.readyState !== WebSocket.OPEN) break;
        wswf.ws.send(`${i}`);
        await wait(10);
    }
}

wss.on("connection", async (ws) => {
    priamryWebSocket = {
        ws: ws,
        isCancelled: false
    };
    console.log("connected");
    ws.on("message", (msg) => {
        if (priamryWebSocket == null) {
            return;
        }
        console.log(`user said: ${msg}`);
        if (msg.toString() == "cancel") {
            console.log("cancelled")
            priamryWebSocket.isCancelled = true;
        }
        priamryWebSocket.ws.send("alive");
    });

    // test(wswf);

    ws.on("close", () => {
        priamryWebSocket = null;
        console.log("ded");
    });
});


app.get("/get-all-scores", async (req: Request, res: Response) => {
    if (!osuApi) {
        res.status(500).json({ erorr: "API not initialized" });
        return;
    } else {
        if (!priamryWebSocket) {
            console.log("No websocket, continuing without messaging")
        } else {
            console.log("We have a websocket so there should be messaging");
        }
        if (userInfo.osuId == -1) {
            res.status(500).json({ error: "User not initialized" });
            return;
        }
        try {
            await dumpAllScores(priamryWebSocket, osuApi, delay, userInfo.osuId);
            res.status(200).json({ success: "Completed dumping!" });
        } catch (err) {
            res.status(500).json({ error: String(err) });
            console.log(err);
            return;
        }

    }
});

// Note to self: This is just basic ass top play fetching, should probably change this so on fetch it tries to add itself to db
app.get("/top-plays{/:username}", async (req: Request, res: Response) => {
    if (osuApi) {
        let user;
        if (req.params.username) {
            try {
                user = (await osuApi.getUser(req.params.username)).id
            } catch (err) {
                res.status(500).json({ error: String(err) })
                console.log(err);
                return;
            }
        } else if (userInfo.osuId != -1) {
            user = Number(userInfo.osuId);
        }
        else {
            res.status(500).json({ error: "Either link username or specify a user" });
            return;
        }
        let scores;
        try {
            scores = await osuApi.getUserScores(
                user,
                "best",
                osu.Ruleset.osu,
                { lazer: false },
                { limit: 5 }
            );
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: String(err) });
            return;
        }
        let scoreStr = await Promise.all(
            scores.map(async (score) => {
                if (osuApi) {
                    await wait(delay);
                    let beatmapDifficulty;
                    try {
                        beatmapDifficulty = await osuApi.getBeatmapDifficultyAttributesOsu(
                            score.beatmap,
                            score.mods
                        );
                    } catch (err) {
                        console.log(`error while getting beat map difficulty attributes from API: ${err}`);
                        return;
                    }

                    return `${score.beatmapset.artist} - ${score.beatmapset.title} [${score.beatmap.version}] +${score.mods.map(m => m.acronym).join("")} (${beatmapDifficulty.star_rating.toFixed(2)}*)`;
                } else return;
            })
        );
        res.status(200).json(scoreStr);
        return;
    }
    else {
        res.status(500).json({ error: "No osu API" });
        return;
    }
});

app.post("/set-user", async (req: Request, res: Response) => {
    const recievedData = req.body;
    if (osuApi) {
        try {
            if (recievedData["user"]) {
                const osuUserData = await osuApi.getUser(String(recievedData["user"]));
                setEnv("OSU_USER_ID", String(osuUserData.id));
                setEnv("OSU_USERNAME", osuUserData.username);
                userInfo.osuId = osuUserData.id;
                userInfo.osuName = osuUserData.username;
                await database.insertUser(osuUserData.id, osuUserData.username);
                res.status(200).json({ msg: `Hello ${osuUserData.username}!` });
            }
        } catch (err) {
            try {
                const attemptConvert = Number(recievedData["user"]);
                if (Number.isNaN(attemptConvert)) {
                    throw "No user found";
                }
                const osuUserData = await osuApi.getUser(attemptConvert);
                setEnv("OSU_USER_ID", String(osuUserData.id));
                setEnv("OSU_USERNAME", osuUserData.username);
                userInfo.osuId = osuUserData.id;
                userInfo.osuName = osuUserData.username;
                await database.insertUser(osuUserData.id, osuUserData.username);
                res.status(200).json({ msg: `Hello ${osuUserData.username}!` });
            } catch (err2) {
                res.status(500).json({ error: String(err2) });
                return;
            }
        }
    }
    else {
        res.status(500).json({ error: "No osu API" });
        return;
    }
});

app.post("/set-api", async (req: Request, res: Response) => {
    const recievedData = req.body;
    if (recievedData["client_id"] && recievedData["client_secret"]) {
        try {
            osuApi = await osu.API.createAsync(Number(recievedData["client_id"]), String(recievedData["client_secret"]));
            const me = await osuApi.getUser("cloudiees");
            setEnv("OSU_CLIENT_ID", String(recievedData["client_id"]));
            setEnv("OSU_CLIENT_SECRET", String(recievedData["client_secret"]));
            if (me.username != "cloudiees") {
                res.status(500).json({ error: "Something went wrong, please try again later" });
                return;
            } else {
                res.status(200).json({ msg: "Success!" });
                return;
            }

        } catch (err) {
            res.status(500).json({ error: String(err) })
            return;
        }
    }
    else if (recievedData["client_id"]) {
        res.status(500).json({ error: "No 'client_secret' found in request." });
        return;
    }
    else {
        res.status(500).json({ error: "No 'client_id' found in request." });
        return;
    }
});

app.get("/info", (req: Request, res: Response) => {
    // Note to self
    // Status = 250 means nothing is configured
    // Status = 251 means API but not user is configured
    // Status = 252 means API is not configured but user is (technically should never happen)
    // Status = 253 means both API and user are configured
    let respStatus = 250;
    if (osuApi) respStatus += 1;
    if (userInfo.osuId != -1) respStatus += 2;
    res.status(respStatus).json({ currentConfig: `API: ${osuApi ? "Yes" : "No"} - User: ${userInfo.osuId != -1 ? "Yes" : "No"}` });
});

(async () => {
    try {
        await database.createDatabase();
        osuApi = await readEnv(userInfo);
        console.log(`${userInfo.osuId}, ${userInfo.osuName}`);
        if (userInfo.osuId != -1) await database.insertUser(userInfo.osuId, userInfo.osuName);
    } catch (err) {
        console.log(err);
    }
})();


const PORT = 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));