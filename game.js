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
let isHost = false;
let pollTimer = null;


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
            Math.floor(
                Math.random() * chars.length
            )
        ];

    }

    return code;
}


/* =========================================
   GET PLAYERS
========================================= */

async function loadPlayers() {

    if (!roomCode) return;

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

        toast("Could not load players.");

        return;
    }


    renderPlayers(data || []);
}


/* =========================================
   DISPLAY PLAYERS
========================================= */

function renderPlayers(players) {

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
            <span>${escapeHtml(player.name)}</span>
            ${player.is_host ? " 👑" : ""}
        `;

        container.appendChild(div);

    });


    /* START BUTTON */

    const startButton =
        document.getElementById("start");

    if (isHost) {

        startButton.disabled =
            players.length < 2;

    }

}


/* =========================================
   SAFE TEXT
========================================= */

function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
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

        toast(
            "Enter your name first!"
        );

        return;
    }


    /* Generate room code */

    roomCode =
        generateRoomCode();


    /* Create room */

    const { error: roomError } =
        await supabaseClient
            .from("rooms")
            .insert({
                code: roomCode
            });


    if (roomError) {

        console.error(roomError);

        /* Try another code if collision */

        roomCode =
            generateRoomCode();

        const retry =
            await supabaseClient
                .from("rooms")
                .insert({
                    code: roomCode
                });

        if (retry.error) {

            toast(
                "Could not create room."
            );

            return;
        }

    }


    isHost = true;


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

        console.error(playerError);

        toast(
            "Could not add you to room."
        );

        return;
    }


    document.getElementById("roomCode")
        .textContent = roomCode;


    showScreen("lobby");


    startPolling();


    toast(
        "Room created!"
    );
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

        toast(
            "Enter your name first!"
        );

        return;
    }


    if (!roomCode) {

        toast(
            "Enter the room code!"
        );

        return;
    }


    /* Check room */

    const { data: room, error } =
        await supabaseClient
            .from("rooms")
            .select("code")
            .eq("code", roomCode)
            .maybeSingle();


    if (error) {

        console.error(error);

        toast(
            "Could not check room."
        );

        return;
    }


    if (!room) {

        toast(
            "Room does not exist."
        );

        return;
    }


    /* Check player count */

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

        console.error(countError);

        toast(
            "Could not check players."
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

    const { error: joinError } =
        await supabaseClient
            .from("players")
            .insert({

                id: playerId,

                room_code: roomCode,

                name: playerName,

                is_host: false

            });


    if (joinError) {

        console.error(joinError);

        toast(
            "Could not join room."
        );

        return;
    }


    isHost = false;


    document.getElementById("roomCode")
        .textContent = roomCode;


    showScreen("lobby");


    startPolling();


    toast(
        "Joined room!"
    );
}


/* =========================================
   LIVE PLAYER UPDATES
========================================= */

function startPolling() {

    stopPolling();

    loadPlayers();

    /*
       Check every second.
       This makes the lobby update
       even if Realtime is unavailable.
    */

    pollTimer =
        setInterval(
            loadPlayers,
            1000
        );
}


function stopPolling() {

    if (pollTimer) {

        clearInterval(pollTimer);

        pollTimer = null;
    }
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


    const { data: players, error } =
        await supabaseClient
            .from("players")
            .select("*")
            .eq(
                "room_code",
                roomCode
            )
            .order(
                "joined_at",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(error);

        toast(
            "Could not start game."
        );

        return;
    }


    if (!players || players.length < 2) {

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


    /*
       For now this starts the game screen.
       We'll add the actual UNO engine next.
    */

    stopPolling();

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
   COPY ROOM CODE
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
            "Room code: " + roomCode
        );

    }
}


/* =========================================
   LEAVE ROOM
========================================= */

async function leaveRoom() {

    stopPolling();


    if (roomCode) {

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
   DRAW
========================================= */

document.getElementById("draw")
    .addEventListener(
        "click",
        () => {

            toast(
                "UNO game engine coming next."
            );

        }
    );


/* =========================================
   UNO
========================================= */

document.getElementById("uno")
    .addEventListener(
        "click",
        () => {

            toast("UNO!");

        }
    );


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
   COLOR PICKER
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
