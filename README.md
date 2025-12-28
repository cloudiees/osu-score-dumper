# osu! Score Dumper

A GUI based score dumper for osu! to get all your scores.

## Description

An in-depth paragraph about this project and overview of use.

## Getting Started

### Dependencies

* Node.js >= 23.9.0
* npm >= 10.9.2

### Installing

1. Clone the repo
    ```sh
    git clone https://github.com/cloudiees/osu-score-dumper.git
    ```
2. Install NPM packages in both `osd-backend` and `osd-frontend`
    ```sh
    npm install
    ```

### Executing program

1. Run the backend in `osd-backend`
   ```sh
   npm run dev
   ```
2. Run the frontend in `osd-frontend`
   ```sh
   npm run dev
   ```

## TODO List
- Implement frontend score dumper interface
  - Start score dump
  - Cancel score dump
  - See status of score dump
  - Toggles for score dump (recalculate SR)
- Implement various views accessible via frontend
  - Sort by SR, pp, acc, only show unique, etc.
- Make it look pretty 
  - Note to self: you suck at UI design, use existing libraries and components pls
- Make this an Electron app
- Make this a one click run, user should never need to use command line to run this

## License

This project is licensed under GPL-3.0. See the `LICENSE.txt` file for details

## Acknowledgments

* [DomPizzie's README-Template.md](https://gist.github.com/DomPizzie/7a5ff55ffa9081f2de27c315f5018afc)
  * The template used for this readme
* [Best-README-Template](https://github.com/othneildrew/Best-README-Template)
  * Borrowed some elements for readme items
* [score-fetcher](https://github.com/LeaPhant/score-fetcher)
  * Inspired me to create this app