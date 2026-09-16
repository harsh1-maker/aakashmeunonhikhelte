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
   PLAYER
========================================= */

let playerId = crypto.randomUUID();
let playerName = "";
let roomCode = "";
let isHost = false;

let pollTimer = null;
let gameTimer = null;


/* =========================================
   SCREEN
========================================= */

function showScreen(id) {

    document.querySelectorAll(".screen")
        .forEach(screen => {
            screen.classList.remove("active");
        });

    const screen =
        document.getElementById(id);

    if (screen) {
        screen.classList.add("active");
    }
}


/* =========================================
   TOAST
========================================= */

function toast(message) {

    const box =
        document.getElementById("toast");

    box.textContent = message;

    box.classList.add("show");

    setTimeout(() => {
        box.classList.remove("show");
    }, 2500);
}


/* =========================================
   ROOM CODE
========================================= */

function generateRoomCode() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {

        code += chars[
            Math.floor(
                Math.random() * chars.length
            )
        ];

    }

    return code;
}


/* =========================================
   LOAD ROOM
========================================= */

async function loadRoom() {

    if (!roomCode) return null;

    const { data, error } =
        await supabaseClient
            .from("rooms")
            .select("*")
            .eq("code", roomCode)
            .maybeSingle();

    if (error) {

        console.error(
            "Room error:",
            error
        );

        return null;
    }

    return data;
}


/* =========================================
   LOAD PLAYERS
========================================= */

async function loadPlayers() {

    if (!roomCode) return [];

    const { data, error } =
        await supabaseClient
            .from("players")
            .select("*")
            .eq("room_code", roomCode)
            .order("joined_at", {
                ascending: true
            });

    if (error) {

        console.error(
            "Players error:",
            error
        );

        return [];
    }

    renderPlayers(data || []);

    return data || [];
}


/* =========================================
   RENDER PLAYERS
========================================= */

function renderPlayers(players) {

    const container =
        document.getElementById("players");

    const count =
        document.getElementById("count");

    const startButton =
        document.getElementById("start");


    container.innerHTML = "";


    count.textContent =
        ` (${players.length}/6)`;


    players.forEach(player => {

        const div =
            document.createElement("div");

        div.className = "player";


        const name =
            document.createElement("span");

        name.textContent =
            player.name;


        const host =
            document.createElement("span");

        host.textContent =
            player.is_host
                ? " 👑"
                : "";


        div.appendChild(name);
        div.appendChild(host);

        container.appendChild(div);

    });


    /* Host controls START button */

    if (isHost) {

        startButton.disabled =
            players.length < 2;

    } else {

        startButton.disabled = true;

    }

}


/* =========================================
   START LOBBY WATCHER
========================================= */

function startWatching() {

    stopWatching();


    /* Update players every second */

    pollTimer =
        setInterval(async () => {

            const players =
                await loadPlayers();


            const room =
                await loadRoom();


            if (!room) return;


            /* If host started the game,
               every device enters game */

            if (
                room.game_started === true &&
                !document
                    .getElementById("game")
                    .classList
                    .contains("active")
            ) {

                stopWatching();

                showScreen("game");

                document.getElementById("turn")
                    .textContent =
                    "Game started!";

                document.getElementById("color")
                    .textContent =
                    "Color: -";

            }

        }, 1000);


    /* Load immediately */

    loadPlayers();

}


function stopWatching() {

    if (pollTimer) {

        clearInterval(pollTimer);

        pollTimer = null;

    }

}


/* =========================================
   CREATE ROOM
========================================= */

async function createRoom() {

    playerId =
        crypto.randomUUID();


    playerName =
        document.getElementById("name")
            .value
            .trim();


    if (!playerName) {

        toast(
            "Enter your name first!"
        );

        return;
    }


    /* Generate unique room */

    let created = false;


    for (let i = 0; i < 5; i++) {

        roomCode =
            generateRoomCode();


        const { error } =
            await supabaseClient
                .from("rooms")
                .insert({
                    code: roomCode,
                    game_started: false
                });


        if (!error) {

            created = true;

            break;

        }

    }


    if (!created) {

        toast(
            "Could not create room."
        );

        return;
    }


    /* Add host */

    const { error: playerError } =
        await supabaseClient
            .from("players")
            .insert({

                id: playerId,

                room_code: roomCode,

                name: playerName,

                is_host: true

            });


    if (playerError) {

        console.error(
            playerError
        );

        toast(
            "Could not add host."
        );

        return;
    }


    isHost = true;


    document.getElementById("roomCode")
        .textContent = roomCode;


    showScreen("lobby");


    startWatching();


    toast(
        "Room created!"
    );

}


/* =========================================
   JOIN ROOM
========================================= */

async function joinRoom() {

    playerId =
        crypto.randomUUID();


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

        toast(
            "Enter your name first!"
        );

        return;
    }


    if (!roomCode) {

        toast(
            "Enter room code!"
        );

        return;
    }


    /* Check room */

    const room =
        await loadRoom();


    if (!room) {

        toast(
            "Room does not exist!"
        );

        return;
    }


    if (room.game_started) {

        toast(
            "Game already started!"
        );

        return;
    }


    /* Check number of players */

    const { count, error: countError } =
        await supabaseClient
            .from("players")
            .select(
                "id",
                {
                    count: "exact",
                    head: true
                }
            )
            .eq(
                "room_code",
                roomCode
            );


    if (countError) {

        console.error(
            countError
        );

        toast(
            "Could not check room."
        );

        return;
    }


    if (count >= 6) {

        toast(
            "Room is full!"
        );

        return;
    }


    /* Add player */

    const { error } =
        await supabaseClient
            .from("players")
            .insert({

                id: playerId,

                room_code: roomCode,

                name: playerName,

                is_host: false

            });


    if (error) {

        console.error(
            "JOIN ERROR:",
            error
        );

        toast(
            "Could not join room."
        );

        return;
    }


    isHost = false;


    document.getElementById("roomCode")
        .textContent = roomCode;


    showScreen("lobby");


    startWatching();


    toast(
        "Joined room!"
    );

}


/* =========================================
   START GAME
========================================= */

async function startGame() {

    if (!isHost) {

        toast(
            "Only the host can start."
        );

        return;
    }


    const players =
        await loadPlayers();


    if (players.length < 2) {

        toast(
            "Need at least 2 players!"
        );

        return;
    }


    if (players.length > 6) {

        toast(
            "Maximum 6 players!"
        );

        return;
    }


    /* Update database */

    const { error } =
        await supabaseClient
            .from("rooms")
            .update({
                game_started: true
            })
            .eq(
                "code",
                roomCode
            );


    if (error) {

        console.error(
            "START ERROR:",
            error
        );

        toast(
            "Could not start game."
        );

        return;
    }


    stopWatching();


    showScreen("game");


    document.getElementById("turn")
        .textContent =
        "Game started!";


    document.getElementById("color")
        .textContent =
        "Color: -";


    toast(
        "Game started!"
    );

}


/* =========================================
   COPY CODE
========================================= */

async function copyRoom() {

    if (!roomCode) return;


    try {

        await navigator.clipboard
            .writeText(roomCode);

        toast(
            "Room code copied!"
        );

    } catch {

        toast(
            roomCode
        );

    }

}


/* =========================================
   LEAVE ROOM
========================================= */

async function leaveRoom() {

    stopWatching();


    if (roomCode && playerId) {

        await supabaseClient
            .from("players")
            .delete()
            .eq(
                "id",
                playerId
            );

    }


    roomCode = "";

    isHost = false;


    document.getElementById("players")
        .innerHTML = "";

    document.getElementById("count")
        .textContent = "";

    document.getElementById("roomCode")
        .textContent = "------";


    showScreen("home");

}


/* =========================================
   DRAW BUTTON
========================================= */

document.getElementById("draw")
    .addEventListener(
        "click",
        () => {

            toast(
                "UNO engine will be added next."
            );

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
   HOME BUTTONS
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


/* =========================================
   LOBBY BUTTONS
========================================= */

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

            document.getElementById("color")
                .textContent =
                "Color: " +
                button.dataset.color;

            document.getElementById("modal")
                .classList.add("hidden");

        }
    );

});


/* =========================================
   READY
========================================= */

console.log(
    "UNO Friends loaded successfully."
);
