import * as osu from "osu-api-v2-js";
import { WebSocket } from "ws";
import wait from "./wait";
import WebSocketWithFlags from "../interfaces/flaggedWS";
import { OsuDatabase } from "../database";

const rankedStatus = {
    "graveyard": -2,
    "wip": -1,
    "pending": 0,
    "ranked": 1,
    "approved": 2,
    "qualified": 3,
    "loved": 4
}

let apiCallsCounter = 0;
const database: OsuDatabase = OsuDatabase.getInstance();

/**
 * Dumps all scores for a specified user into the database
 * @param wswf Websocket with flags
 * @param api osu!API object
 * @param delay Delay in MS
 * @param userId ID of the user to query for
 * @param refactorStarRating Whether to recalc star ratings for maps already in the database
 */
export async function dumpAllScores(wswf: WebSocketWithFlags | null, api: osu.API, delay: number, userId: number, refactorStarRating: boolean = false) {
    // I just wanna see how much im abusing the API
    apiCallsCounter = 0;
    const apiCallsInterval = setInterval(() => {
        console.log(`API calls this past minute: ${apiCallsCounter}`)
        apiCallsCounter = 0;
    }, 60_000);

    if (wswf && wswf.ws.readyState == WebSocket.OPEN) wswf.ws.send("Starting dumping");
    else console.log("Started dumping");

    const limit = 100;
    let offset = 0;

    while (true) {
        if (wswf?.isCancelled) {
            console.log("Canceled operation via websocket...");
            if (wswf.ws.readyState == WebSocket.OPEN) wswf.ws.send("Canceled dumping");
            break;
        }
        const mostPlayed = await api.getUserMostPlayed(userId, { limit: limit, offset: offset });
        apiCallsCounter++;

        if (wswf && wswf.ws.readyState == WebSocket.OPEN) wswf.ws.send(`Retrieved ${mostPlayed.length} maps (currently at ${offset + limit} maps)`);
        else console.log(`Retrieved ${mostPlayed.length} maps (currently at ${offset + limit} maps)`);

        // No maps found
        if (mostPlayed.length == 0) break;

        for (let played of mostPlayed) {
            const mapsetId = played.beatmapset.id;
            const title = played.beatmapset.title;
            const artist = played.beatmapset.artist;
            await database.insertMapset(mapsetId, title, artist);

            const mapId = played.beatmap_id;
            const status = rankedStatus[played.beatmap.status];
            const version = played.beatmap.version;
            await database.insertMap(mapsetId, version, mapId, status);

            // Skipping over maps that we know dont have leaderboards/saved scores
            if (status == osu.Beatmapset.RankStatus.Graveyard || status == osu.Beatmapset.RankStatus.Pending || status == osu.Beatmapset.RankStatus.Wip) continue;

            if (wswf && wswf.ws.readyState == WebSocket.OPEN) wswf.ws.send(`Scanning ${artist} - ${title} [${version}] for scores`);
            else console.log(`Scanning ${artist} - ${title} [${version}] for scores`);

            const scores = await api.getBeatmapUserScores(mapId, userId, {
                ruleset: osu.Ruleset.osu
            });
            apiCallsCounter++;

            if (wswf && wswf.ws.readyState == WebSocket.OPEN) wswf.ws.send(`Got ${scores.length} scores`);
            else console.log(`Got ${scores.length} scores`);
            // Caching for "optimization"
            let mods = new Map<string, number>();
            // Adds mod combos that are alr in the database to the cache
            if (!refactorStarRating) {
                const previousModCombos = await database.getModCombosForMap(mapId);
                if (previousModCombos) {
                    for (let prevModCombo of previousModCombos) {
                        mods.set(prevModCombo.modCombo, prevModCombo.starRating);
                    }
                }
            }
            let shouldWait = true;
            let scoreCounter = 0; // Score counter used for logging/websocket
            for (let score of scores) {
                const isLazer = score.started_at == null ? 0 : 1;
                const scoreId = score.id;
                const accuracy = score.accuracy;
                const modsArr = score.mods;
                const scoreVal = score.total_score;
                let valid = true;
                let modsStrArr: string[] = [];
                for (let mod of modsArr) {
                    if (mod.settings) {
                        valid = false;
                        break;
                    }
                    modsStrArr.push(mod.acronym);
                }
                if (!valid) continue;
                let modsStr = modsStrArr.join(",");
                let starRating = mods.get(modsStr);
                if (starRating == undefined) {
                    starRating = (await api.getBeatmapDifficultyAttributes(mapId, modsArr, osu.Ruleset.osu)).star_rating;
                    apiCallsCounter++;
                    mods.set(modsStr, starRating);
                    shouldWait = true;
                }
                if (refactorStarRating) await database.upsertModCombo(mapId, modsStr, starRating);
                else await database.insertModCombo(mapId, modsStr, starRating);
                database.insertScore(scoreId, userId, mapId, modsStr, isLazer, scoreVal, accuracy);
                scoreCounter++;
                if (wswf && wswf.ws.readyState == WebSocket.OPEN) wswf.ws.send(`Scanned ${scoreCounter}/${scores.length} scores`);
                else console.log(`Scanned ${scoreCounter}/${scores.length} scores`);
                if (shouldWait) {
                    shouldWait = false;
                    await wait(delay);
                }
            }
        }

        offset += mostPlayed.length;
        await wait(delay);
    }
    console.log("done 😸");
    clearInterval(apiCallsInterval);
}