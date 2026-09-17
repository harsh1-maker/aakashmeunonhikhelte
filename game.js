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

let waitingForColor = false;


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

    if (!box) return;

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

    if (!roomCode) return null;

    const { data, error } =
        await supabaseClient
            .from("rooms")
            .select("*")
            .eq("code", roomCode)
            .maybeSingle();

    if (error) {

        console.error(
            "ROOM ERROR:",
            error
        );

        return null;
    }

    return data;
}


async function getPlayers() {

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
            "PLAYERS ERROR:",
            error
        );

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


    if (!container) return;


    container.innerHTML = "";


    if (count) {

        count.textContent =
            ` (${players.length}/6)`;

    }


    players.forEach(player => {

        const row =
            document.createElement("div");

        row.className =
            "player";


        const name =
            document.createElement("span");

        name.textContent =
            player.name;


        const crown =
            document.createElement("span");

        crown.textContent =
            player.is_host
                ? " 👑"
                : "";


        row.appendChild(name);

        row.appendChild(crown);

        container.appendChild(row);

    });


    if (!start) return;


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

        console.error(
            "CREATE PLAYER ERROR:",
            error
        );

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


    /* NUMBER CARDS */

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


        /* SKIP */

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


        /* REVERSE */

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


    /* WILD */

    for (let i = 0; i < 4; i++) {

        deck.push({

            color: "wild",

            type: "wild",

            value: "WILD"

        });

    }


    /* +4 */

    for (let i = 0; i < 4; i++) {

        deck.push({

            color: "wild",

            type: "draw4",

            value: "+4"

        });

    }


    /* CUSTOM +10 */

    for (let i = 0; i < 4; i++) {

        deck.push({

            color: "wild",

            type: "draw10",

            value: "+10"

        });

    }


    /* CUSTOM +20 */

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


    /* DEAL 7 CARDS */

    for (let i = 0; i < 7; i++) {

        players.forEach(player => {

            hands[player.id].push(
                deck.pop()
            );

        });

    }


    /* FIRST DISCARD */

    let firstCard =
        deck.pop();


    while (
        firstCard.type === "wild" ||
        firstCard.type === "draw4" ||
        firstCard.type === "draw10" ||
        firstCard.type === "draw20"
    ) {

        deck.unshift(
            firstCard
        );

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


        pendingDraw: 0,


        pendingDrawType: null

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

        console.error(
            "GAME INIT ERROR:",
            error
        );

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


    if (!currentPlayer) return;


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
                "YOUR TURN 🔥";

        } else {

            turn.textContent =
                currentPlayer.name +
                "'s turn";

        }

    }


    const color =
        document.getElementById("color");


    if (color) {

        color.textContent =
            "Color: " +
            state.currentColor;

    }


    const topCard =
        state.discard[
            state.discard.length - 1
        ];


    renderTopCard(
        topCard
    );


    renderHand(
        myHand,
        state
    );


    renderOpponents(
        state
    );


    const draw =
        document.getElementById("draw");

    const uno =
        document.getElementById("uno");


    const myTurn =
        currentPlayer.id === playerId;


    if (draw) {

        draw.disabled =
            state.winner !== null ||
            !myTurn ||
            waitingForColor;

    }


    if (uno) {

        uno.disabled =
            state.winner !== null ||
            !myTurn ||
            waitingForColor;

    }

}


/* =========================================
   TOP CARD
========================================= */

function renderTopCard(card) {

    const top =
        document.getElementById("topCard");


    if (!top || !card) return;


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


    if (!container) return;


    container.innerHTML = "";


    const top =
        state.discard[
            state.discard.length - 1
        ];


    const current =
        state.players[
            state.currentPlayer
        ];


    const myTurn =
        current &&
        current.id === playerId;


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


        const playable =
            myTurn &&
            !waitingForColor &&
            canPlay(
                card,
                top,
                state.currentColor
            );


        if (playable) {

            /* POP + GLOW */

            button.classList.add(
                "playable"
            );

        } else {

            button.classList.add(
                "disabled"
            );

        }


        button.addEventListener(
            "click",
            () => {

                if (!myTurn) {

                    toast(
                        "Wait for your turn!"
                    );

                    return;

                }


                if (waitingForColor) {

                    toast(
                        "Choose a color first!"
                    );

                    return;

                }


                if (!playable) {

                    toast(
                        "You can't play that card!"
                    );

                    return;

                }


                playCard(index);

            }
        );


        container.appendChild(
            button
        );

    });

}


/* =========================================
   OPPONENTS
========================================= */

function renderOpponents(state) {

    const container =
        document.getElementById("opponents");


    if (!container) return;


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


            /* NAME */

            const name =
                document.createElement("div");

            name.textContent =
                player.name;

            name.style.fontWeight =
                "900";


            /* CARD COUNT */

            const count =
                state.hands[player.id]
                    ? state.hands[player.id].length
                    : 0;


            const cardCount =
                document.createElement("div");

            cardCount.textContent =
                count + " cards";

            cardCount.style.fontSize =
                "11px";

            cardCount.style.opacity =
                "0.75";


            /* HIDDEN CARDS */

            const cards =
                document.createElement("div");

            cards.className =
                "opponent-cards";


            /*
             * ONLY THE NUMBER OF CARDS
             * IS USED HERE.
             *
             * ACTUAL CARD VALUES ARE
             * NEVER RENDERED.
             */

            const visibleCards =
                Math.min(
                    count,
                    10
                );


            for (
                let i = 0;
                i < visibleCards;
      
