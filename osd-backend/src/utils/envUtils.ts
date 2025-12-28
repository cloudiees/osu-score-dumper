import fs from "fs";
import * as osu from "osu-api-v2-js";
import "dotenv/config";
import { UserObject } from "../interfaces/dbInterfaces";

export function setEnv(key: string, value: string) {
    if (!fs.existsSync(".env")) {
        fs.writeFileSync(".env", `${key}=${value}`);
        return;
    }
    let env = String(fs.readFileSync(".env")).split("\n");
    let found = false;
    env = env.map((entry) => {
        if (entry.startsWith(`${key}=`)) {
            found = true;
            return `${key}=${value}`;
        }
        return entry;
    });
    let data: string;
    if (found) {
        data = env.join("\n");
    }
    else {
        data = env.join("\n");
        data = data.concat(`\n${key}=${value}`);
    }
    fs.writeFileSync(".env", data)
    return;
}

export async function readEnv(userInfo: UserObject): Promise<osu.API | null> {
    if (!fs.existsSync(".env")) {
        return null;
    }
    try {
        if ("OSU_CLIENT_ID" in process.env && "OSU_CLIENT_SECRET" in process.env) {
            const osuApi = await osu.API.createAsync(
                Number(process.env.OSU_CLIENT_ID),
                String(process.env.OSU_CLIENT_SECRET)
            );
            console.log("Got API");
            if ("OSU_USER_ID" in process.env) {
                console.log(osuApi.getUser(Number(process.env.OSU_USER_ID)));
                userInfo.osuId = Number(process.env.OSU_USER_ID);
                userInfo.osuName = String(process.env.OSU_USERNAME);
                console.log("Got user info");

            } else {
                console.log(osuApi.getUser("cloudiees"));
            }
            return osuApi;
        }
    } catch (err) {
        console.log(`Error reading .env: ${err}`)
        return null;
    }
    return null;
}