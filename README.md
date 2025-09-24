# Survival Voxel Game

This is a simple survival voxel game built with JavaScript and three.js. It features a procedurally generated world, a hunger system, and the ability to build and destroy blocks. The game also uses Firebase for data persistence, allowing players to save and load their worlds.

## Features

*   **Procedurally Generated World:** The game generates a new world every time you play, with varied terrain including hills, trees, and beaches.
*   **Building and Destroying:** You can destroy existing blocks and build new ones to create your own structures.
*   **Hunger System:** You have a hunger bar that depletes over time. You'll need to find food to survive.
*   **Data Persistence:** The game uses Firebase to save your world data, so you can pick up where you left off.
*   **Immersive Skybox:** The game features a beautiful skybox that changes throughout the day.

## How to Run

To run the game, you need to have a web server that can serve the files. You can use any web server you like, but here are a few options:

*   **Python's built-in HTTP server:** If you have Python installed, you can run the following command in the project's root directory:

    ```bash
    python -m http.server
    ```

*   **Node.js `http-server` package:** If you have Node.js installed, you can install the `http-server` package and run it:

    ```bash
    npm install -g http-server
    http-server
    ```

Once you have a web server running, you can open your browser and navigate to the server's address (e.g., `http://localhost:8000`).

## Firebase Setup

The game uses Firebase for data persistence. To use this feature, you need to set up a Firebase project and configure the game to use it.

1.  **Create a Firebase project:** Go to the [Firebase console](https://console.firebase.google.com/) and create a new project.
2.  **Add a web app:** In your Firebase project, add a new web app and copy the Firebase configuration object.
3.  **Configure the game:** In `js/main.js`, find the `firebaseConfig` variable and replace the placeholder object with your Firebase configuration object.

**Note:** The game will still work without Firebase, but you won't be able to save or load your world.