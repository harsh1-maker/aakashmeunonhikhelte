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
   HELPERS
========================================= */

function showScreen(id) {

    document.querySelectorAll(".screen")
        .forEach(screen => {
            screen.classList.remove("active");
        });

    document.getElementById(id)
        .classList.add("active");
}


function toast(message) {

    const box =
        document.getElementById("toast");

    box.textContent = message;

    box.classList.add("show");

    setTimeout(() => {
        box.classList.remove("show");
    }, 2500);
}


function generateRoomCode() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {
        code += chars[
            Math.floor(Math.random() * chars.length)
        ];
    }

    return code;
}


/* =========================================
   ADD PLAYER
========================================= */

function addPlayer(player) {

    if (!player || !player.id) return;

    const existing =
        players.find(p => p.id === player.id);

    if (!existing) {

        players.push({
            id: player.id,
            name: player.name,
            host: player.host === true
        });

    } else {

        existing.name = player.name;
        existing.host = player.host === true;

    }

    renderPlayers();
}


/* =========================================
   REMOVE PLAYER
========================================= */

function removePlayer(id) {

    players =
        players.filter(p => p.id !== id);

    renderPlayers();
}


/* =========================================
   RENDER PLAYERS
========================================= */

function renderPlayers() {

    const container =
        document.getElementById("players");

    const count =
        document.getElementById("count");

    container.innerHTML = "";

    count.textContent =
        ` (${players.length}/6)`;


    players.forEach(player => {

        const div =
            document.createElement("div");

        div.className = "player";

        div.innerHTML = `
            <span>${player.name}</span>
            ${player.host ? " 👑" : ""}
        `;

        container.appendChild(div);

    });


    /* Enable / disable START button */

    const startButton =
        document.getElementById("start");

    if (isHost) {

        startButton.disabled =
            players.length < 2;

    }

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


    roomCode =
        generateRoomCode();

    isHost = true;

    players = [];


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

        toast("Enter the room code!");

        return;
    }


    isHost = false;

    players = [];


    await connectRoom();


    document.getElementById("roomCode")
        .textContent = roomCode;

    showScreen("lobby");

    toast("Joined room!");

}


/* =========================================
   CONNECT TO ROOM
========================================= */

async function connectRoom() {

    if (channel) {

        await supabaseClient
            .removeChannel(channel);

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


    /* -------------------------
       PRESENCE SYNC
    ------------------------- */

    channel.on(
        "presence",
        {
            event: "sync"
        },
        () => {

            const state =
                channel.presenceState();

            players = [];


            Object.values(state)
                .forEach(list => {

                    list.forEach(player => {

                        addPlayer(player);

                    });

                });

        }
    );


    /* -------------------------
       PLAYER JOINED
    ------------------------- */

    channel.on(
        "broadcast",
        {
            event: "player-joined"
        },
        ({ payload }) => {

            addPlayer(payload);

        }
    );


    /* -------------------------
       PLAYER LEFT
    ------------------------- */

    channel.on(
        "broadcast",
        {
            event: "player-left"
        },
        ({ payload }) => {

            removePlayer(payload.id);

        }
    );


    /* -------------------------
       GAME START
    ------------------------- */

    channel.on(
        "broadcast",
        {
            event: "start-game"
        },
        () => {

            showScreen("game");

            document.getElementById("turn")
                .textContent =
                "Game started!";

        }
    );


    /* -------------------------
       SUBSCRIBE
    ------------------------- */

    const status =
        await new Promise(resolve => {

            channel.subscribe(status => {

                resolve(status);

            });

        });


    if (status !== "SUBSCRIBED") {

        toast("Connection failed!");

        console.error(
            "Supabase connection:",
            status
        );

        return;

    }


    /* -------------------------
       ADD OURSELVES
    ------------------------- */

    const me = {

        id: playerId,

        name: playerName,

        host: isHost

    };


    addPlayer(me);


    /* -------------------------
       SUPABASE PRESENCE
    ------------------------- */

    await channel.track(me);


    /* -------------------------
       TELL EVERYONE
    ------------------------- */

    await channel.send({

        type: "broadcast",

        event: "player-joined",

        payload: me

    });


    /* -------------------------
       ASK EXISTING PLAYERS
    ------------------------- */

    await channel.send({

        type: "broadcast",

        event: "player-joined",

        payload: me

    });


    renderPlayers();

}


/* =========================================
   START GAME
========================================= */

async function startGame() {

    if (!isHost) {

        toast(
            "Only the host can start the game."
        );

        return;
    }


    if (players.length < 2) {

        toast(
            "You need at least 2 players!"
        );

        return;
    }


    if (players.length > 6) {

        toast(
            "Maximum 6 players!"
        );

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
        .textContent =
        "Game started!";

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

        toast(
            "Room code: " + roomCode
        );

    }

}


/* =========================================
   LEAVE ROOM
========================================= */

async function leaveRoom() {

    if (channel) {

        await channel.send({

            type: "broadcast",

            event: "player-left",

            payload: {
                id: playerId
            }

        });


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

}


/* =========================================
   DRAW CARD
========================================= */

document.getElementById("draw")
    .addEventListener(
        "click",
        () => {

            toast("Draw card");

        }
    );


/* =========================================
   UNO BUTTON
========================================= */

document.getElementById("uno")
    .addEventListener(
        "click",
        () => {

            toast("UNO!");

        }
    );


/* =========================================
   CREATE
========================================= */

document.getElementById("create")
    .addEventListener(
        "click",
        createRoom
    );


/* =========================================
   JOIN
========================================= */

document.getElementById("join")
    .addEventListener(
        "click",
        joinRoom
    );


/* =========================================
   COPY
========================================= */

document.getElementById("copy")
    .addEventListener(
        "click",
        copyRoom
    );


/* =========================================
   START
========================================= */

document.getElementById("start")
    .addEventListener(
        "click",
        startGame
    );


/* =========================================
   LEAVE
========================================= */

document.getElementById("leave")
    .addEventListener(
        "click",
        leaveRoom
    );


/* =========================================
   COLOR PICKER
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

console.log(
    "UNO Friends multiplayer loaded."
);
