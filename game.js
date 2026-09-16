/* =========================================
   SUPABASE
========================================= */

const SUPABASE_URL =
    "https://cumwoqdzpsidocqvulxd.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_1ibhlNKv4SuESO57U1FJGw_s208R7FI";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


/* =========================================
   VARIABLES
========================================= */

let roomCode = "";
let playerId = crypto.randomUUID();
let playerName = "";
let channel = null;
let isHost = false;
let players = [];


/* =========================================
   BASIC FUNCTIONS
========================================= */

function showScreen(id) {
    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });

    document.getElementById(id).classList.add("active");
}


function toast(message) {
    const box = document.getElementById("toast");

    box.textContent = message;
    box.classList.add("show");

    setTimeout(() => {
        box.classList.remove("show");
    }, 2500);
}


function generateRoomCode() {
    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {
        code += characters[
            Math.floor(Math.random() * characters.length)
        ];
    }

    return code;
}


/* =========================================
   UPDATE PLAYER LIST
========================================= */

function updatePlayers() {

    if (!channel) return;

    const presence = channel.presenceState();

    players = [];

    Object.values(presence).forEach(list => {

        list.forEach(player => {

            if (!players.some(p => p.id === player.id)) {
                players.push(player);
            }

        });

    });

    renderPlayers();
}


function renderPlayers() {

    const container =
        document.getElementById("players");

    const count =
        document.getElementById("count");

    container.innerHTML = "";

    count.textContent =
        ` (${players.length}/6)`;


    players.forEach((player, index) => {

        const div =
            document.createElement("div");

        div.className = "player";

        div.textContent =
            player.name +
            (player.host ? " 👑" : "");

        container.appendChild(div);

    });
}


/* =========================================
   CREATE ROOM
========================================= */

async function createRoom() {

    playerName =
        document.getElementById("name")
            .value
            .trim();

    if (!playerName) {
        toast("Enter your name first!");
        return;
    }

    roomCode = generateRoomCode();

    isHost = true;

    await connectRoom();

    document.getElementById("roomCode")
        .textContent = roomCode;

    showScreen("lobby");

    toast("Room created!");
}


/* =========================================
   JOIN ROOM
========================================= */

async function joinRoom() {
   console.log("JOIN BUTTON CLICKED");

    playerName =
        document.getElementById("name")
            .value
            .trim();

    roomCode =
        document.getElementById("code")
            .value
            .trim()
            .toUpperCase();

    if (!playerName) {
        toast("Enter your name first!");
        return;
    }

    if (!roomCode) {
        toast("Enter a room code!");
        return;
    }

    if (roomCode.length < 4) {
        toast("Invalid room code!");
        return;
    }

    isHost = false;

    await connectRoom();

    document.getElementById("roomCode")
        .textContent = roomCode;

    showScreen("lobby");

    toast("Joined room!");
}


/* =========================================
   CONNECT TO SUPABASE ROOM
========================================= */

async function connectRoom() {

    if (channel) {
        await supabaseClient.removeChannel(channel);
    }

    channel =
        supabaseClient.channel(
            "uno-room-" + roomCode,
            {
                config: {
                    presence: {
                        key: playerId
                    }
                }
            }
        );


    channel.on(
        "presence",
        {
            event: "sync"
        },
        () => {

            updatePlayers();

        }
    );


    channel.on(
        "broadcast",
        {
            event: "start-game"
        },
        () => {

            showScreen("game");

            document.getElementById("turn")
                .textContent = "Game started!";

            toast("Game started!");

        }
    );


    const result =
        await channel.subscribe();


    if (result !== "SUBSCRIBED") {

        toast("Could not connect to room.");

        return;
    }


    await channel.track({
        id: playerId,
        name: playerName,
        host: isHost
    });


    updatePlayers();
}


/* =========================================
   COPY ROOM CODE
========================================= */

async function copyRoom() {

    if (!roomCode) return;

    try {

        await navigator.clipboard
            .writeText(roomCode);

        toast("Room code copied!");

    } catch {

        toast("Room code: " + roomCode);

    }
}


/* =========================================
   START GAME
========================================= */

async function startGame() {

    if (!isHost) {

        toast("Only the host can start the game.");

        return;
    }


    if (players.length < 2) {

        toast("Need at least 2 players!");

        return;
    }


    if (players.length > 6) {

        toast("Maximum 6 players!");

        return;
    }


    await channel.send({

        type: "broadcast",

        event: "start-game",

        payload: {
            started: true
        }

    });


    showScreen("game");

    document.getElementById("turn")
        .textContent = "Game started!";

}


/* =========================================
   LEAVE ROOM
========================================= */

async function leaveRoom() {

    if (channel) {

        await supabaseClient
            .removeChannel(channel);

        channel = null;
    }

    roomCode = "";
    players = [];
    isHost = false;

    document.getElementById("players")
        .innerHTML = "";

    document.getElementById("roomCode")
        .textContent = "------";

    showScreen("home");

    toast("Left room.");
}


/* =========================================
   GAME BUTTONS
========================================= */

document.getElementById("draw")
    .addEventListener("click", () => {

        toast("Draw card");

    });


document.getElementById("uno")
    .addEventListener("click", () => {

        toast("UNO!");

    });


/* =========================================
   BUTTONS
========================================= */

document.getElementById("create")
    .addEventListener(
        "click",
        createRoom
    );


document.getElementById("join")
    .addEventListener(
        "click",
        joinRoom
    );


document.getElementById("copy")
    .addEventListener(
        "click",
        copyRoom
    );


document.getElementById("start")
    .addEventListener(
        "click",
        startGame
    );


document.getElementById("leave")
    .addEventListener(
        "click",
        leaveRoom
    );


/* =========================================
   COLOR BUTTONS
========================================= */

document.querySelectorAll(
    "[data-color]"
).forEach(button => {

    button.addEventListener(
        "click",
        () => {

            const color =
                button.dataset.color;

            document.getElementById("color")
                .textContent =
                "Color: " + color;

            document.getElementById("modal")
                .classList.add("hidden");

        }
    );

});


/* =========================================
   READY
========================================= */

console.log("UNO Friends loaded successfully.");
