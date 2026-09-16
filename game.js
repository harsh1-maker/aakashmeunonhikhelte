/* =========================================
   SUPABASE SETTINGS
========================================= */

const SUPABASE_URL =
    "https://cumwoqdzpsidocqvulxd.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_1ibhlNKv4SuESO57U1FJGw_s208R7FI";


/* =========================================
   SUPABASE
========================================= */

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


/* =========================================
   VARIABLES
========================================= */

let roomCode = null;
let playerId = crypto.randomUUID();
let playerName = null;
let channel = null;
let players = [];


/* =========================================
   HELPERS
========================================= */

function $(id) {
    return document.getElementById(id);
}

function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });

    const screen = $(screenId);

    if (screen) {
        screen.classList.add("active");
    }
}

function showToast(message) {
    const toast = $("toast");

    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";

    for (let i = 0; i < 5; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }

    return code;
}


/* =========================================
   SUPABASE ROOM CONNECTION
========================================= */

async function connectToRoom(code) {

    roomCode = code.toUpperCase();

    channel = supabaseClient.channel(
        "uno-room-" + roomCode,
        {
            config: {
                presence: {
                    key: playerId
                }
            }
        }
    );

    channel
        .on(
            "presence",
            {
                event: "sync"
            },
            () => {
                updatePlayers();
            }
        )
        .on(
            "broadcast",
            {
                event: "player-joined"
            },
            ({ payload }) => {

                if (!players.find(p => p.id === payload.id)) {
                    players.push(payload);
                    renderPlayers();
                }
            }
        )
        .on(
            "broadcast",
            {
                event: "room-created"
            },
            ({ payload }) => {

                if (payload.host !== playerId) {
                    showToast(payload.name + " created the room");
                }
            }
        );

    const status = await channel.subscribe(async (status) => {

        if (status === "SUBSCRIBED") {

            await channel.track({
                id: playerId,
                name: playerName,
                host: false
            });

            updatePlayers();

            showScreen("lobby");
            renderRoomCode();

            showToast("Connected to room!");
        }
    });

    return status;
}


/* =========================================
   PLAYERS
========================================= */

function updatePlayers() {

    if (!channel) return;

    const state = channel.presenceState();

    players = [];

    Object.values(state).forEach(entries => {

        entries.forEach(player => {

            if (!players.find(p => p.id === player.id)) {
                players.push(player);
            }

        });

    });

    renderPlayers();
}


function renderPlayers() {

    const list =
        $("playersList") ||
        $("playerList") ||
        $("lobbyPlayers");

    if (!list) return;

    list.innerHTML = "";

    players.forEach((player, index) => {

        const div = document.createElement("div");

        div.className = "player";

        div.innerHTML = `
            <span>${player.name || "Player"}</span>
            ${index === 0 ? "<small>HOST</small>" : ""}
        `;

        list.appendChild(div);
    });
}


/* =========================================
   ROOM CODE
========================================= */

function renderRoomCode() {

    const elements = [
        $("roomCode"),
        $("roomCodeDisplay"),
        $("lobbyCode")
    ];

    elements.forEach(element => {

        if (element) {
            element.textContent = roomCode;
        }

    });
}


/* =========================================
   CREATE ROOM
========================================= */

async function createRoom() {

    const nameInput =
        $("playerName") ||
        $("nameInput") ||
        $("username");

    if (!nameInput) {
        showToast("Name input not found");
        return;
    }

    playerName = nameInput.value.trim();

    if (!playerName) {
        showToast("Enter your name first!");
        return;
    }

    roomCode = generateRoomCode();

    channel = supabaseClient.channel(
        "uno-room-" + roomCode,
        {
            config: {
                presence: {
                    key: playerId
                }
            }
        }
    );

    channel
        .on(
            "presence",
            {
                event: "sync"
            },
            () => {
                updatePlayers();
            }
        );

    await channel.subscribe(async (status) => {

        if (status === "SUBSCRIBED") {

            await channel.track({
                id: playerId,
                name: playerName,
                host: true
            });

            updatePlayers();

            showScreen("lobby");
            renderRoomCode();

            showToast("Room created!");
        }
    });
}


/* =========================================
   JOIN ROOM
========================================= */

async function joinRoom() {

    const nameInput =
        $("playerName") ||
        $("nameInput") ||
        $("username");

    const codeInput =
        $("roomCodeInput") ||
        $("joinCode") ||
        $("roomInput");

    if (!nameInput || !codeInput) {
        showToast("Name or room code field not found");
        return;
    }

    playerName = nameInput.value.trim();
    const code = codeInput.value.trim();

    if (!playerName) {
        showToast("Enter your name first!");
        return;
    }

    if (!code) {
        showToast("Enter a room code!");
        return;
    }

    await connectToRoom(code);
}


/* =========================================
   START GAME
========================================= */

async function startGame() {

    if (!channel) {
        showToast("Create or join a room first!");
        return;
    }

    if (players.length < 2) {
        showToast("Need at least 2 players!");
        return;
    }

    await channel.send({
        type: "broadcast",
        event: "game-start",
        payload: {
            started: true
        }
    });

    showScreen("game");

    showToast("Game started!");
}


/* =========================================
   COPY ROOM CODE
========================================= */

async function copyRoomCode() {

    if (!roomCode) return;

    try {

        await navigator.clipboard.writeText(roomCode);

        showToast("Room code copied!");

    } catch {

        showToast(roomCode);

    }
}


/* =========================================
   BUTTON CONNECTIONS
========================================= */

function setupButtons() {

    const createButtons = [
        $("createRoom"),
        $("createRoomBtn"),
        $("createBtn")
    ];

    createButtons.forEach(button => {

        if (button) {
            button.addEventListener("click", createRoom);
        }

    });


    const joinButtons = [
        $("joinRoom"),
        $("joinRoomBtn"),
        $("joinBtn")
    ];

    joinButtons.forEach(button => {

        if (button) {
            button.addEventListener("click", joinRoom);
        }

    });


    const startButtons = [
        $("startGame"),
        $("startGameBtn"),
        $("startBtn")
    ];

    startButtons.forEach(button => {

        if (button) {
            button.addEventListener("click", startGame);
        }

    });


    const copyButtons = [
        $("copyRoom"),
        $("copyRoomBtn"),
        $("copyBtn")
    ];

    copyButtons.forEach(button => {

        if (button) {
            button.addEventListener("click", copyRoomCode);
        }

    });
}


/* =========================================
   STARTUP
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    setupButtons();

    console.log("UNO Friends loaded successfully.");

});
