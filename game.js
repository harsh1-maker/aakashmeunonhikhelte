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
   PLAYER / ROOM
========================================= */

let playerId = crypto.randomUUID();
let playerName = "";
let roomCode = "";
let isHost = false;

let lobbyTimer = null;
let gameTimer = null;


/* =========================================
   BASIC UI
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


function toast(message) {

    const box =
        document.getElementById("toast");

    box.textContent = message;
    box.classList.add("show");

    setTimeout(() => {
        box.classList.remove("show");
    }, 2200);
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
   ROOM
========================================= */

async function getRoom() {

    const { data, error } =
        await supabaseClient
            .from("rooms")
            .select("*")
            .eq("code", roomCode)
            .maybeSingle();

    if (error) {
        console.error(error);
        return null;
    }

    return data;
}


async function getPlayers() {

    const { data, error } =
        await supabaseClient
            .from("players")
            .select("*")
            .eq("room_code", roomCode)
            .order("joined_at", {
                ascending: true
            });

    if (error) {

        console.error(error);

        return [];

    }

    return data || [];
}


/* =========================================
   LOBBY
========================================= */

async function refreshLobby() {

    if (!roomCode) return;

    const players =
        await getPlayers();

    renderPlayers(players);


    const room =
        await getRoom();

    if (
        room &&
        room.game_started === true
    ) {

        stopLobby();

        await loadGame();

    }
}


function renderPlayers(players) {

    const container =
        document.getElementById("players");

    const count =
        document.getElementById("count");

    const start =
        document.getElementById("start");


    container.innerHTML = "";

    count.textContent =
        ` (${players.length}/6)`;


    players.forEach(player => {

        const row =
            document.createElement("div");

        row.className = "player";


        const name =
            document.createElement("span");

        name.textContent =
            player.name;


        const crown =
            document.createElement("span");

        crown.textContent =
            player.is_host ? " 👑" : "";


        row.appendChild(name);
        row.appendChild(crown);

        container.appendChild(row);

    });


    if (isHost) {

        start.disabled =
            players.length < 2;

    } else {

        start.disabled = true;

    }

}


function startLobby() {

    stopLobby();

    refreshLobby();

    lobbyTimer =
        setInterval(
            refreshLobby,
            1000
        );

}


function stopLobby() {

    if (lobbyTimer) {

        clearInterval(lobbyTimer);

        lobbyTimer = null;

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


    let created = false;


    for (let i = 0; i < 10; i++) {

        roomCode =
            generateRoomCode();


        const { error } =
            await supabaseClient
                .from("rooms")
                .insert({
                    code: roomCode,
                    game_started: false,
                    game_state: null
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


    const { error } =
        await supabaseClient
            .from("players")
            .insert({

                id: playerId,

                room_code: roomCode,

                name: playerName,

                is_host: true

            });


    if (error) {

        console.error(error);

        toast(
            "Could not create player."
        );

        return;

    }


    isHost = true;


    document.getElementById("roomCode")
        .textContent = roomCode;


    showScreen("lobby");

    startLobby();


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


    const room =
        await getRoom();


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


    const players =
        await getPlayers();


    if (players.length >= 6) {

        toast(
            "Room is full!"
        );

        return;

    }


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

        console.error(error);

        toast(
            "Could not join room."
        );

        return;

    }


    isHost = false;


    document.getElementById("roomCode")
        .textContent = roomCode;


    showScreen("lobby");

    startLobby();


    toast(
        "Joined room!"
    );

}


/* =========================================
   UNO DECK
========================================= */

function createDeck() {

    const deck = [];

    const colors = [
        "red",
        "yellow",
        "green",
        "blue"
    ];


    /* Number cards */

    colors.forEach(color => {

        deck.push({
            color,
            type: "number",
            value: 0
        });


        for (let n = 1; n <= 9; n++) {

            deck.push({
                color,
                type: "number",
                value: n
            });

            deck.push({
                color,
                type: "number",
                value: n
            });

        }


        /* Skip */

        deck.push({
            color,
            type: "skip",
            value: "SKIP"
        });

        deck.push({
            color,
            type: "skip",
            value: "SKIP"
        });


        /* Reverse */

        deck.push({
            color,
            type: "reverse",
            value: "REV"
        });

        deck.push({
            color,
            type: "reverse",
            value: "REV"
        });


        /* +2 */

        deck.push({
            color,
            type: "draw2",
            value: "+2"
        });

        deck.push({
            color,
            type: "draw2",
            value: "+2"
        });

    });


    /* Wild */

    for (let i = 0; i < 4; i++) {

        deck.push({
            color: "wild",
            type: "wild",
            value: "WILD"
        });

    }


    /* Wild +4 */

    for (let i = 0; i < 4; i++) {

        deck.push({
            color: "wild",
            type: "draw4",
            value: "+4"
        });

    }


    /* =====================================
       CUSTOM +10
    ===================================== */

    for (let i = 0; i < 4; i++) {

        deck.push({
            color: "wild",
            type: "draw10",
            value: "+10"
        });

    }


    /* =====================================
       CUSTOM +20
    ===================================== */

    for (let i = 0; i < 4; i++) {

        deck.push({
            color: "wild",
            type: "draw20",
            value: "+20"
        });

    }


    return shuffle(deck);

}


function shuffle(array) {

    const result =
        [...array];


    for (
        let i = result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
            );


        [
            result[i],
            result[j]
        ] =
        [
            result[j],
            result[i]
        ];

    }


    return result;

}


/* =========================================
   GAME SETUP
========================================= */

async function initializeGame() {

    const players =
        await getPlayers();


    if (players.length < 2) {

        toast(
            "Need at least 2 players!"
        );

        return false;

    }


    const deck =
        createDeck();


    const hands = {};


    players.forEach(player => {

        hands[player.id] = [];

    });


    /* Deal 7 cards */

    for (let i = 0; i < 7; i++) {

        players.forEach(player => {

            hands[player.id].push(
                deck.pop()
            );

        });

    }


    /* First discard must be a normal card */

    let firstCard =
        deck.pop();


    while (
        firstCard.type === "wild" ||
        firstCard.type === "draw4" ||
        firstCard.type === "draw10" ||
        firstCard.type === "draw20"
    ) {

        deck.unshift(firstCard);

        firstCard =
            deck.pop();

    }


    const gameState = {

        players:
            players.map(p => ({
                id: p.id,
                name: p.name
            })),

        deck,

        hands,

        discard: [
            firstCard
        ],

        currentPlayer: 0,

        direction: 1,

        currentColor:
            firstCard.color,

        winner: null,

        started: true,

        unoCalled: {},

        pendingDraw: 0

    };


    const { error } =
        await supabaseClient
            .from("rooms")
            .update({

                game_started: true,

                game_state:
                    gameState

            })
            .eq(
                "code",
                roomCode
            );


    if (error) {

        console.error(error);

        toast(
            "Could not start game."
        );

        return false;

    }


    return true;

}


/* =========================================
   START GAME
========================================= */

async function startGame() {

    if (!isHost) {

        toast(
            "Only host can start."
        );

        return;

    }


    const players =
        await getPlayers();


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


    const room =
        await getRoom();


    /* Don't initialize twice */

    if (
        room &&
        room.game_state &&
        room.game_started
    ) {

        await loadGame();

        return;

    }


    const success =
        await initializeGame();


    if (!success) return;


    stopLobby();


    await loadGame();

}


/* =========================================
   LOAD GAME
========================================= */

async function loadGame() {

    stopLobby();


    showScreen("game");


    await refreshGame();


    stopGameWatcher();


    gameTimer =
        setInterval(
            refreshGame,
            700
        );

}


/* =========================================
   STOP GAME WATCHER
========================================= */

function stopGameWatcher() {

    if (gameTimer) {

        clearInterval(gameTimer);

        gameTimer = null;

    }

}


/* =========================================
   REFRESH GAME
========================================= */

async function refreshGame() {

    const room =
        await getRoom();


    if (
        !room ||
        !room.game_state
    ) {

        return;

    }


    renderGame(
        room.game_state
    );

}


/* =========================================
   RENDER GAME
========================================= */

function renderGame(state) {

    if (!state) return;


    const myHand =
        state.hands[playerId] || [];


    const currentPlayer =
        state.players[
            state.currentPlayer
        ];


    const turn =
        document.getElementById("turn");


    if (state.winner) {

        turn.textContent =
            state.winner.name +
            " WON! 🏆";

    } else {

        if (
            currentPlayer.id === playerId
        ) {

            turn.textContent =
                "YOUR TURN";

        } else {

            turn.textContent =
                currentPlayer.name +
                "'s turn";

        }

    }


    document.getElementById("color")
        .textContent =
        "Color: " +
        state.currentColor;


    renderTopCard(
        state.discard[
            state.discard.length - 1
        ]
    );


    renderHand(
        myHand,
        state
    );


    renderOpponents(
        state
    );


    document.getElementById("draw")
        .disabled =
        state.winner !== null ||
        currentPlayer.id !== playerId;


    document.getElementById("uno")
        .disabled =
        state.winner !== null ||
        currentPlayer.id !== playerId;

}


/* =========================================
   TOP CARD
========================================= */

function renderTopCard(card) {

    const top =
        document.getElementById("topCard");


    top.className =
        "card " +
        (
            card.color === "wild"
                ? "wild"
                : card.color
        );


    top.textContent =
        card.value;

}


/* =========================================
   HAND
========================================= */

function renderHand(
    hand,
    state
) {

    const container =
        document.getElementById("hand");


    container.innerHTML = "";


    hand.forEach((card, index) => {

        const button =
            document.createElement("button");


        button.className =
            "card " +
            (
                card.color === "wild"
                    ? "wild"
                    : card.color
            );


        button.textContent =
            card.value;


        const top =
            state.discard[
                state.discard.length - 1
            ];


        if (
            state.players[
                state.currentPlayer
            ].id !== playerId ||
            !canPlay(
                card,
                top,
                state.currentColor
            )
        ) {

            button.classList.add(
                "disabled"
            );

        }


        button.addEventListener(
            "click",
            () => {

                playCard(index);

            }
        );


        container.appendChild(button);

    });

}


/* =========================================
   OPPONENTS
========================================= */

function renderOpponents(state) {

    const container =
        document.getElementById("opponents");


    container.innerHTML = "";


    state.players.forEach(
        (player, index) => {

            if (
                player.id === playerId
            ) return;


            const div =
                document.createElement("div");


            div.className =
                "opp";


            if (
                index ===
                state.currentPlayer
            ) {

                div.classList.add(
                    "active"
                );

            }


            const count =
                state.hands[player.id]
                    ? state.hands[player.id]
                        .length
                    : 0;


            div.textContent =
                player.name +
                " • " +
                count +
                " cards";


            container.appendChild(div);

        }
    );

}


/* =========================================
   VALID CARD
========================================= */

function canPlay(
    card,
    top,
    currentColor
) {

    if (
        card.color === "wild"
    ) {

        return true;

    }


    if (
        card.color === currentColor
    ) {

        return true;

    }


    if (
        card.type === "number" &&
        top.type === "number" &&
        card.value === top.value
    ) {

        return true;

    }


    if (
        card.type === top.type &&
        card.type !== "number"
    ) {

        return true;

    }


    return false;

}


/* =========================================
   PLAY CARD
========================================= */

async function playCard(index) {

    const room =
        await getRoom();


    if (
        !room ||
        !room.game_state
    ) {

        return;

    }


    const state =
        room.game_state;


    if (state.winner) return;


    const current =
        state.players[
            state.currentPlayer
        ];


    if (
        current.id !== playerId
    ) {

        toast(
            "Not your turn!"
        );

        return;

    }


    const hand =
        state.hands[playerId];


    const card =
        hand[index];


    if (!card) return;


    const top =
        state.discard[
            state.discard.length - 1
        ];


    if (
        !canPlay(
            card,
            top,
            state.currentColor
        )
    ) {

        toast(
            "You can't play that card!"
        );

        return;

    }


    /* Remove from hand */

    hand.splice(
        index,
        1
    );


    /* Put on discard */

    state.discard.push(
        card
    );


    /* UNO state */

    state.unoCalled[playerId] =
        false;


    /* Winner */

    if (hand.length === 0) {

        state.winner = {

            id: playerId,

            name:
                state.players.find(
                    p =>
                        p.id === playerId
                ).name

        };


        await saveGame(
            state
        );

        return;

    }


    /* Wild cards */

    if (
        card.type === "wild" ||
        card.type === "draw4" ||
        card.type === "draw10" ||
        card.type === "draw20"
    ) {

        await saveGame(
            state
        );


        openColorPicker();

        return;

    }


    /* Set color */

    state.currentColor =
        card.color;


    /* Special cards */

    let skip = false;


    if (
        card.type === "skip"
    ) {

        skip = true;

    }


    if (
        card.type === "reverse"
    ) {

        state.direction *= -1;


        if (
            state.players.length === 2
        ) {

            skip = true;

        }

    }


    if (
        card.type === "draw2"
    ) {

        state.pendingDraw = 2;

        skip = true;

    }


    if (
        card.type === "draw4"
    ) {

        state.pendingDraw = 4;

        skip = true;

    }


    if (
        card.type === "draw10"
    ) {

        state.pendingDraw = 10;

        skip = true;

    }


    if (
        card.type === "draw20"
    ) {

        state.pendingDraw = 20;

        skip = true;

    }


    advanceTurn(
        state,
        skip
    );


    await saveGame(
        state
    );

}


/* =========================================
   ADVANCE TURN
========================================= */

function advanceTurn(
    state,
    skip = false
) {

    const total =
        state.players.length;


    let next =
        state.currentPlayer;


    next +=
        state.direction;


    if (next < 0) {

        next =
            total - 1;

    }


    if (next >= total) {

        next = 0;

    }


    if (skip) {

        next +=
            state.direction;


        if (next < 0) {

            next =
                total - 1;

        }


        if (next >= total) {

            next = 0;

        }

    }


    state.currentPlayer =
        next;


    state.currentColor =
        state.discard[
            state.discard.length - 1
        ].color;

}


/* =========================================
   DRAW CARD
========================================= */

async function drawCard() {

    const room =
        await getRoom();


    if (
        !room ||
        !room.game_state
    ) return;


    const state =
        room.game_state;


    if (state.winner) return;


    const current =
        state.players[
            state.currentPlayer
        ];


    if (
        current.id !== playerId
    ) {

        toast(
            "Not your turn!"
        );

        return;

    }


    const amount =
        state.pendingDraw > 0
            ? state.pendingDraw
            : 1;


    const hand =
        state.hands[playerId];


    for (
        let i = 0;
        i < amount;
        i++
    ) {

        if (
            state.deck.length === 0
        ) {

            refillDeck(
                state
            );

        }


        if (
            state.deck.length > 0
        ) {

            hand.push(
                state.deck.pop()
            );

        }

    }


    state.pendingDraw = 0;


    advanceTurn(
        state
    );


    await saveGame(
        state
    );

}


/* =========================================
   REFILL DECK
========================================= */

function refillDeck(state) {

    if (
        state.discard.length <= 1
    ) return;


    const top =
        state.discard[
            state.discard.length - 1
        ];


    const oldDiscard =
        state.discard.slice(
            0,
            -1
        );


    state.deck =
        shuffle(
            oldDiscard
        );


    state.discard = [
        top
    ];

}


/* =========================================
   UNO
========================================= */

async function callUNO() {

    const room =
        await getRoom();


    if (
        !room ||
        !room.game_state
    ) return;


    const state =
        room.game_state;


    const hand =
        state.hands[playerId];


    if (
        hand &&
        hand.length === 1
    ) {

        state.unoCalled[playerId] =
            true;


        toast(
            "UNO! 🔥"
        );


        await saveGame(
            state
        );

    } else {

        toast(
            "You can only call UNO with 1 card!"
        );

    }

}


/* =========================================
   SAVE GAME
========================================= */

async function saveGame(state) {

    const { error } =
        await supabaseClient
            .from("rooms")
            .update({
                game_state: state
            })
            .eq(
                "code",
                roomCode
            );


    if (error) {

        console.error(
            "SAVE GAME ERROR:",
            error
        );

        toast(
            "Game update failed."
        );

    }

}


/* =========================================
   COLOR PICKER
========================================= */

function openColorPicker() {

    document.getElementById("modal")
        .classList.remove("hidden");

}


document.querySelectorAll(
    "[data-color]"
).forEach(button => {

    button.addEventListener(
        "click",
        async () => {

            const color =
                button.dataset.color;


            const room =
                await getRoom();


            if (
                !room ||
                !room.game_state
            ) return;


            const state =
                room.game_state;


            const last =
                state.discard[
                    state.discard.length - 1
                ];


            state.currentColor =
                color;


            let skip = false;


            if (
                last.type === "draw4" ||
                last.type === "draw10" ||
                last.type === "draw20"
            ) {

                state.pendingDraw =
                    last.type === "draw4"
                        ? 4
                        : last.type === "draw10"
                            ? 10
                            : 20;

                skip = true;

            }


            advanceTurn(
                state,
                skip
            );


            document.getElementById("modal")
                .classList.add("hidden");


            await saveGame(
                state
            );

        }
    );

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


document.getElementById("draw")
    .addEventListener(
        "click",
        drawCard
    );


document.getElementById("uno")
    .addEventListener(
        "click",
        callUNO
    );


/* =========================================
   COPY
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
   LEAVE
========================================= */

async function leaveRoom() {

    stopLobby();

    stopGameWatcher();


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


    showScreen("home");

}


/* =========================================
   STARTUP
========================================= */

console.log(
    "UNO Friends - Full Game Loaded"
);
