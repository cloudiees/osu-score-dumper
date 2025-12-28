interface UserObject {
    osuId: number,
    osuName: string
}

interface MapsetObject {
    mapsetId: number,
    name: string,
    artist: string
}

interface MapObject {
    mapId: number,
    mapsetId: number,
    status: number,
    version: string
}

interface ModComboObject {
    mapId: number,
    modCombo: string,
    starRating: number
}

interface ScoreObject {
    scoreId: number,
    userId: number,
    mapId: number,
    modCombo: string,
    lazer: number,
    score: number,
    accuracy: number
}

export {ScoreObject, ModComboObject, MapObject, MapsetObject, UserObject}