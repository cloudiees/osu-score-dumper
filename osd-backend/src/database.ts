import sqlite3 from 'sqlite3';
import path, { resolve } from 'path';
import { MapObject, ModComboObject } from './interfaces/dbInterfaces';

sqlite3.verbose();

export class OsuDatabase {
  private db: sqlite3.Database;
  static instance: OsuDatabase;
  private constructor() {
    this.db = new sqlite3.Database(path.resolve('database.db'), (err) => {
      if (err) console.error("DB connection error:", err);
      else console.log("Connected to SQLite database");
    });
  }
  static getInstance() {
    if (!OsuDatabase.instance) {
      OsuDatabase.instance = new OsuDatabase();
    }
    return OsuDatabase.instance;
  }

  /**
   * Wrapper for db.run that returns a promise that resolves once the query is completed
   * @param sqlStatement SQL query to execute
   * @param parameters Parameters for the SQL query
   * @returns Promise that resolves once the SQL query completes
   */
  private runPromise(sqlStatement: string, parameters: any = null): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sqlStatement, parameters ?? [], (err) => {
        if (err) {
          console.log(err);
          reject(err);
        }
        resolve();
      });
    });
  }

  /**
   * Creates the database tables
   */
  async createDatabase(): Promise<void> {
    // Enabling foreign keys cus sqlite3 doesnt have it on my default
    const foreignKeyActiveCmd = `PRAGMA foreign_keys = ON;`
    await this.runPromise(foreignKeyActiveCmd);
    // Adding user table for each unique osu! user that will be in the db
    const usersCmd = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        osu_id INTEGER NOT NULL UNIQUE,
        osu_name TEXT NOT NULL
      );
    `
    await this.runPromise(usersCmd)
    // Adding each unique mapset (only storing some info)
    const mapsetCmd = `
      CREATE TABLE IF NOT EXISTS mapsets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mapset_id INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        artist TEXT NOT NULL
      );
    `
    await this.runPromise(mapsetCmd);
    // Adding every unique map
    const mapCmd = `
      CREATE TABLE IF NOT EXISTS maps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        map_id INTEGER NOT NULL UNIQUE,
        mapset_id INTEGER NOT NULL,
        status INTEGER NOT NULL CHECK (status >= -2 AND status <= 4),
        version TEXT NOT NULL,
        FOREIGN KEY (mapset_id) REFERENCES mapsets(mapset_id) ON DELETE CASCADE
      );
    `
    await this.runPromise(mapCmd);
    // Adding every relavent unique mod combo + map and storing the SR
    const modCombosCmd = `
      CREATE TABLE IF NOT EXISTS mod_combos (
        map_id INTEGER NOT NULL,
        mod_combo TEXT NOT NULL,
        star_rating REAL NOT NULL,
        PRIMARY KEY (map_id, mod_combo),
        FOREIGN KEY (map_id) REFERENCES maps(map_id) ON DELETE CASCADE
      );
    `
    await this.runPromise(modCombosCmd);
    // Storing a score with associated user, map, and mod combo
    const scoreCmd = `
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        score_id INTEGER NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        map_id INTEGER NOT NULL,
        mod_combo TEXT NOT NULL,
        lazer INTEGER NOT NULL CHECK (lazer = 0 OR lazer = 1),
        score REAL NOT NULL,
        accuracy REAL NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(osu_id) ON DELETE CASCADE,
        FOREIGN KEY (map_id, mod_combo) REFERENCES mod_combos(map_id, mod_combo) ON DELETE CASCADE
      );
    `
    await this.runPromise(scoreCmd);
  }

  /**
   * Inserts a given mapset into the database
   * @param mapsetId ID from osu! of the mapset that is being inserted
   * @param title Title of the song for the mapset
   * @param artist Name of the song artist
   * @returns Promise that resolves once the SQL query is completed
   */
  insertMapset(mapsetId: number, title: string, artist: string) {
    const mapsetInsertCmd = `
  INSERT OR IGNORE INTO mapsets (mapset_id, name, artist)
  VALUES (?, ?, ?);
  `;
    return this.runPromise(mapsetInsertCmd, [mapsetId, title, artist]);
  }

  /**
   * Inserts a given map into the database
   * @param mapsetId ID from osu! of the mapset for the map that is being inserted
   * @param version The version/difficulty name of the map
   * @param mapId ID from osu! of the map that is being inserted
   * @param status The ranked status of the map
   * @returns Promise that resolves once the SQL query is completed
   */
  insertMap(mapsetId: number, version: string, mapId: number, status: number): Promise<void> {
    const mapsetInsertCmd = `
  INSERT OR IGNORE INTO maps (map_id, mapset_id, version, status)
  VALUES (?, ?, ?, ?);
  `;
    return this.runPromise(mapsetInsertCmd, [mapId, mapsetId, version, status]);
  }

  /**
   * Inserts a mod combo on a map to the the database
   * @param mapId ID of the osu! map
   * @param modCombo The specific mod combo in the format "XX,XX,..."
   * @param starRating Calculated star rating of the mod combo applied to the given map
   * @returns Promise that resolves once SQL query is completed
   */
  insertModCombo(mapId: number, modCombo: string, starRating: number): Promise<void> {
    const modComboInsertCmd = `
  INSERT OR IGNORE INTO mod_combos (map_id, mod_combo, star_rating)
  VALUES (?, ?, ?);
  `;
    return this.runPromise(modComboInsertCmd, [mapId, modCombo, starRating]);
  }

  /**
   * Attempts to insert a mod combo on a map to the the database, if mod combo already exists then it will instead update the entry with the given star rating
   * @param mapId ID of the osu! map
   * @param modCombo The specific mod combo in the format "XX,XX,..."
   * @param starRating Calculated star rating of the mod combo applied to the given map
   * @returns Promise that resolves once SQL query is completed
   */
  upsertModCombo(mapId: number, modCombo: string, starRating: number): Promise<void> {
    const modComboUpsertCmd = `
  INSERT OR IGNORE INTO mod_combos (map_id, mod_combo, star_rating)
  VALUES (?, ?, ?)
  ON CONFLICT(map_id, mod_combo) DO UPDATE SET star_rating = excluded.star_rating;
  `;
    return this.runPromise(modComboUpsertCmd, [mapId, modCombo, starRating]);
  }

  /**
   * Inserts a given score into the database
   * @param scoreId Score ID from osu! of the score to insert
   * @param userId User ID of the osu! player that played the score
   * @param mapId Map ID of the osu! map the score was set on
   * @param modCombo Mod combo used for this score in the format "XX,XX,..."
   * @param isLazer Whether or not this score was set on lazer
   * @param score The numerical value of the score
   * @param accuracy The accuracy achieved on the score
   * @returns Void promise that resolves when the SQL insert completes
   */
  insertScore(scoreId: number, userId: number, mapId: number, modCombo: string, isLazer: number, score: number, accuracy: number): Promise<void> {
    const scoreInsertCmd = `
  INSERT OR IGNORE INTO scores (score_id, user_id, map_id, mod_combo, lazer, score, accuracy)
  VALUES (?, ?, ?, ?, ?, ?, ?);
  `;
    return this.runPromise(scoreInsertCmd, [scoreId, userId, mapId, modCombo, isLazer, score, accuracy]);
  }

  /**
   * Wrapper for db.all that returns a promise that resolves when the SQL query is completed
   * @param sqlStatement SQL query to be executed
   * @param parameters Parameters for the given SQL query if any
   * @returns A Promise that when resolved returns the data from the query
   */
  private getAllPromise<T>(sqlStatement: string, parameters: any = null): Promise<T[]> {
    return new Promise((resolve, rejects) => {
      this.db.all(sqlStatement, parameters ?? [], (err, data) => {
        if (err) {
          console.log(err);
          rejects(err);
        }
        resolve(data as T[]);
      })
    });
  }

  /**
   * Wrapper for db.get that returns a promise that resolves when the SQL query is completed
   * @param sqlStatement SQL query to be executed
   * @param parameters Parameters for the given SQL query if any
   * @returns A promise that returns the data from the SQL query on resolution
   */
  private getPromise<T>(sqlStatement: string, parameters: any = null): Promise<T[]> {
    return new Promise((resolve, rejects) => {
      this.db.get(sqlStatement, parameters ?? [], (err, data) => {
        if (err) {
          console.log(err);
          rejects(err);
        }
        resolve(data as T[]);
      });
    });
  }

  /**
   * Gets all maps in the database
   * @returns A promise which on resolution returns all maps in the database
   */
  getAllMaps(): Promise<MapObject[]> {
    const getMapCmd = `
    SELECT * FROM maps;
  `;
    return this.getAllPromise<MapObject>(getMapCmd);
  }

  /**
   * Inserts an osu! user into the database
   * @param osuId ID of the osu! user
   * @param osuUser Username of the osu! user
   * @returns A promise that resolves when the insert is completed
   */
  insertUser(osuId: number, osuUser: string): Promise<void> {
    const scoreInsertCmd = `
  INSERT OR IGNORE INTO users (osu_id, osu_name)
  VALUES (?, ?);
  `;
    return this.runPromise(scoreInsertCmd, [osuId, osuUser]);
  }

  /**
   * Gets all the mod combos for a specific map
   * @param mapId ID of the osu! map you want to get the mod combos for
   * @returns A promise which on resolution returns all the mod combos for the specified map
   */
  getModCombosForMap(mapId: number): Promise<ModComboObject[]> {
    const getModCombosCmd = `
  SELECT * FROM mod_combos WHERE map_id = ?;
  `;
    return this.getAllPromise<ModComboObject>(getModCombosCmd, [mapId]);
  }
}