/* =========================================================
   UNO FRIENDS
   FULL UNO-STYLE MULTIPLAYER APP
   ========================================================= */


/* =========================================================
   SUPABASE
   ========================================================= */

const SUPABASE_URL =
    "https://cumwoqdzpsidocqvulxd.supabase.co";

/*
   PUT YOUR EXISTING SUPABASE PUBLISHABLE / ANON KEY HERE
*/
const SUPABASE_KEY =
    "sb_publishable_1ibhlNKv4SuESO57U1FJGw_s208R7FI";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


/* =========================================================
   PLAYER
   ========================================================= */

let playerId = crypto.randomUUID();

let playerName = "";
let roomCode = "";

let isHost = false;

let players = [];

let state = null;

let pollTimer = null;

let colorPickerOpen = false;


/* =========================================================
   BASIC DOM
   ========================================================= */

const home =
    document.getElementById("home");

const lobby =
    document.getElementById("lobby");

const game =
    document.getElementById("game");

const nameInput =
    document.getElementById("name");

const codeInput =
    document.getElementById("code");

const createButton =
    document.getElementById("create");

const joinButton =
    document.getElementById("join");

const startButton =
    document.getElementById("start");

const leaveButton =
    document.getElementById("leave");

const copyButton =
    document.getElementById("copy");


/* =========================================================
   SCREEN CONTROL
   ========================================================= */

function showScreen(screen) {

    document
        .querySelectorAll(".screen")
        .forEach(s => {
            s.classList.remove("active");
        });

    screen.classList.add("active");
}


/* =========================================================
   TOAST
   ========================================================= */

function toast(message) {

    let element =
        document.getElementById("unoToast");

    if (!element) {

        element =
            document.createElement("div");

        element.id = "unoToast";

        document.body.appendChild(element);
    }

    element.textContent = message;

    element.classList.add("show");

    clearTimeout(element.timer);

    element.timer =
        setTimeout(() => {

            element.classList.remove("show");

        }, 2300);
}


/* =========================================================
   RANDOM ROOM
   ========================================================= */

function generateRoomCode() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let result = "";

    for (let i = 0; i < 6; i++) {

        result +=
            chars[
                Math.floor(
                    Math.random() *
                    chars.length
                )
            ];
    }

    return result;
}


/* =========================================================
   SHUFFLE
   ========================================================= */

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
                Math.random() *
                (i + 1)
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


/* =========================================================
   AVATARS
   ========================================================= */

const avatars = [
    "😎",
    "😈",
    "🤠",
    "🦊",
    "🐼",
    "🐸",
    "🐯",
    "🐨",
    "🦁",
    "🐵",
    "🤖",
    "👽",
    "🥷",
    "👻"
];


function getAvatar(name) {

    let value = 0;

    for (
        let i = 0;
        i < name.length;
        i++
    ) {

        value +=
            name.charCodeAt(i);
    }

    return avatars[
        value % avatars.length
    ];
}


/* =========================================================
   DECK
   ========================================================= */

function card(color, value) {

    return {
        id: crypto.randomUUID(),
        color,
        value
    };
}


function createDeck() {

    const deck = [];

    const colors = [
        "red",
        "yellow",
        "green",
        "blue"
    ];


    colors.forEach(color => {

        deck.push(
            card(color, "0")
        );


        for (
            let number = 1;
            number <= 9;
            number++
        ) {

            deck.push(
                card(
                    color,
                    String(number)
                )
            );

            deck.push(
                card(
                    color,
                    String(number)
                )
            );
        }


        for (let i = 0; i < 2; i++) {

            deck.push(
                card(color, "skip")
            );

            deck.push(
                card(color, "reverse")
            );

            deck.push(
                card(color, "+2")
            );
        }

    });


    for (let i = 0; i < 4; i++) {

        deck.push(
            card("wild", "wild")
        );

        deck.push(
            card("wild", "+4")
        );

        deck.push(
            card("wild", "+10")
        );

        deck.push(
            card("wild", "+20")
        );
    }


    return shuffle(deck);
}


/* =========================================================
   CARD DISPLAY
   ========================================================= */

function displayValue(value) {

    if (value === "skip")
        return "⊘";

    if (value === "reverse")
        return "↻";

    return value;
}


/* =========================================================
   ROOM DATABASE
   ========================================================= */

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


async function getRoomPlayers() {

    const { data, error } =
        await supabaseClient
            .from("players")
            .select("*")
            .eq("room_code", roomCode)
            .order(
                "joined_at",
                {
                    ascending: true
                }
            );

    if (error) {

        console.error(error);

        return [];
    }

    return data || [];
}


/* =========================================================
   CREATE ROOM
   ========================================================= */

createButton.addEventListener(
    "click",
    createRoom
);


async function createRoom() {

    playerName =
        nameInput.value.trim();

    if (!playerName) {

        toast(
            "Enter your name"
        );

        return;
    }


    createButton.disabled = true;


    try {

        let newCode =
            generateRoomCode();


        while (
            await roomExists(newCode)
        ) {

            newCode =
                generateRoomCode();
        }


        const {
            error: roomError
        } =
            await supabaseClient
                .from("rooms")
                .insert({

                    code: newCode,

                    game_started: false,

                    game_state: null

                });


        if (roomError) {

            console.error(
                roomError
            );

            toast(
                "Couldn't create room"
            );

            return;
        }


        const {
            error: playerError
        } =
            await supabaseClient
                .from("players")
                .insert({

                    id: playerId,

                    room_code: newCode,

                    name: playerName,

                    is_host: true

                });


        if (playerError) {

            console.error(
                playerError
            );

            toast(
                "Couldn't join room"
            );

            return;
        }


        roomCode =
            newCode;

        isHost = true;

        await enterLobby();


    } finally {

        createButton.disabled =
            false;
    }
}


async function roomExists(code) {

    const {
        data
    } =
        await supabaseClient
            .from("rooms")
            .select("code")
            .eq("code", code)
            .maybeSingle();

    return !!data;
}


/* =========================================================
   JOIN ROOM
   ========================================================= */

joinButton.addEventListener(
    "click",
    joinRoom
);


async function joinRoom() {

    playerName =
        nameInput.value.trim();

    roomCode =
        codeInput.value
            .trim()
            .toUpperCase();


    if (!playerName) {

        toast(
            "Enter your name"
        );

        return;
    }


    if (
        roomCode.length !== 6
    ) {

        toast(
            "Enter a 6-character code"
        );

        return;
    }


    joinButton.disabled =
        true;


    try {

        const room =
            await getRoom();


        if (!room) {

            toast(
                "Room doesn't exist"
            );

            return;
        }


        if (
            room.game_started
        ) {

            toast(
                "Game already started"
            );

            return;
        }


        const existingPlayers =
            await getRoomPlayers();


        if (
            existingPlayers.length >= 6
        ) {

            toast(
                "Room is full"
            );

            return;
        }


        if (
            existingPlayers.some(
                p =>
                    p.name.toLowerCase() ===
                    playerName.toLowerCase()
            )
        ) {

            toast(
                "Name already taken"
            );

            return;
        }


        const {
            error
        } =
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
                "Couldn't join room"
            );

            return;
        }


        isHost = false;

        await enterLobby();


    } finally {

        joinButton.disabled =
            false;
    }
}


/* =========================================================
   LOBBY
   ========================================================= */

async function enterLobby() {

    showScreen(lobby);

    renderLobby();

    startPolling();
}


function startPolling() {

    stopPolling();

    pollTimer =
        setInterval(
            sync,
            800
        );
}


function stopPolling() {

    if (pollTimer) {

        clearInterval(
            pollTimer
        );

        pollTimer = null;
    }
}


/* =========================================================
   SYNC
   ========================================================= */

async function sync() {

    if (!roomCode)
        return;


    const room =
        await getRoom();


    if (!room) {

        stopPolling();

        toast(
            "Room closed"
        );

        showScreen(home);

        return;
    }


    players =
        await getRoomPlayers();


    if (
        room.game_started &&
        room.game_state
    ) {

        state =
            room.game_state;

        stopPolling();

        showScreen(game);

        buildGameInterface();

        renderGame();

        return;
    }


    if (
        lobby.classList.contains(
            "active"
        )
    ) {

        renderLobby();
    }
}


/* =========================================================
   RENDER LOBBY
   ========================================================= */

function renderLobby() {

    const codeElement =
        document.getElementById(
            "roomCode"
        );

    const countElement =
        document.getElementById(
            "count"
        );

    const playersElement =
        document.getElementById(
            "players"
        );


    if (codeElement)
        codeElement.textContent =
            roomCode;


    if (countElement)
        countElement.textContent =
            `(${players.length}/6)`;


    if (!playersElement)
        return;


    playersElement.innerHTML =
        "";


    players.forEach(player => {

        const row =
            document.createElement(
                "div"
            );

        row.className =
            "lobby-player";


        row.innerHTML = `

            <div class="lobby-avatar">
                ${getAvatar(player.name)}
            </div>

            <div class="lobby-player-info">

                <strong>
                    ${escapeHTML(player.name)}
                </strong>

                <small>
                    ${player.is_host
                        ? "HOST"
                        : "PLAYER"}
                </small>

            </div>

            ${
                player.id === playerId
                ? `<span class="lobby-you">
                       YOU
                   </span>`
                : ""
            }

        `;


        playersElement.appendChild(
            row
        );
    });


    if (startButton) {

        startButton.style.display =
            isHost
                ? "block"
                : "none";
    }
}


/* =========================================================
   START GAME
   ========================================================= */

startButton.addEventListener(
    "click",
    startGame
);


async function startGame() {

    if (!isHost)
        return;


    players =
        await getRoomPlayers();


    if (players.length < 2) {

        toast(
            "Need at least 2 players"
        );

        return;
    }


    if (players.length > 6) {

        toast(
            "Maximum 6 players"
        );

        return;
    }


    startButton.disabled =
        true;


    const newState =
        createGameState();


    const {
        error
    } =
        await supabaseClient
            .from("rooms")
            .update({

                game_started: true,

                game_state: newState

            })
            .eq(
                "code",
                roomCode
            );


    if (error) {

        console.error(error);

        toast(
            "Couldn't start game"
        );

        startButton.disabled =
            false;

        return;
    }


    state =
        newState;

    stopPolling();

    showScreen(game);

    buildGameInterface();

    renderGame();
}


/* =========================================================
   INITIAL GAME STATE
   ========================================================= */

function createGameState() {

    let deck =
        createDeck();


    const hands = {};


    players.forEach(player => {

        hands[player.id] =
            [];

        for (
            let i = 0;
            i < 7;
            i++
        ) {

            hands[player.id].push(
                deck.pop()
            );
        }
    });


    let firstCard =
        deck.pop();


    /*
       Don't start on a wild.
    */

    while (
        firstCard &&
        firstCard.color === "wild"
    ) {

        deck.unshift(
            firstCard
        );

        deck =
            shuffle(deck);

        firstCard =
            deck.pop();
    }


    return {

        deck,

        discard: [
            firstCard
        ],

        hands,

        currentPlayerIndex: 0,

        direction: 1,

        currentColor:
            firstCard.color,

        pendingDraw: 0,

        winner: null,

        lastAction:
            "Game started",

        uno: {},

        started: true,

        skipNext: false

    };
}


/* =========================================================
   SAVE STATE
   ========================================================= */

async function saveState() {

    const {
        error
    } =
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

        console.error(error);

        toast(
            "Connection problem"
        );

        return false;
    }

    return true;
}


/* =========================================================
   BUILD FULL GAME INTERFACE
   ========================================================= */

function buildGameInterface() {

    game.innerHTML = `

        <div class="uno-app">

            <!-- TOP BAR -->

            <div class="uno-topbar">

                <div class="uno-brand">
                    UNO
                </div>

                <div
                    class="game-status"
                    id="gameStatus"
                >
                    YOUR TURN
                </div>

                <button
                    class="exit-game"
                    id="exitGame"
                >
                    ✕
                </button>

            </div>


            <!-- OPPONENTS -->

            <div
                class="opponents-zone"
                id="opponentsZone"
            ></div>


            <!-- TABLE -->

            <div class="uno-table">

                <div class="table-highlight"></div>


                <div
                    class="center-message"
                    id="centerMessage"
                >
                    YOUR TURN
                </div>


                <div class="center-piles">

                    <button
                        class="deck-pile"
                        id="newDrawPile"
                    >

                        <div class="deck-back">

                            <span>
                                UNO
                            </span>

                        </div>

                    </button>


                    <div
                        class="discard-pile"
                        id="newDiscardPile"
                    ></div>

                </div>


                <div
                    class="direction-indicator"
                    id="directionIndicator"
                >
                    ↻
                </div>

            </div>


            <!-- CURRENT COLOR -->

            <div
                class="current-color"
                id="currentColor"
            >

                <span></span>

                <b>
                    RED
                </b>

            </div>


            <!-- BOTTOM PLAYER -->

            <div class="bottom-player">

                <div
                    class="my-player"
                    id="myPlayer"
                ></div>


                <div
                    class="my-hand"
                    id="newHand"
                ></div>


                <div class="game-controls">

                    <button
                        class="draw-button"
                        id="newDrawButton"
                    >

                        <span class="draw-icon">
                            +
                        </span>

                        DRAW

                    </button>


                    <button
                        class="uno-button"
                        id="newUnoButton"
                    >

                        <span>
                            UNO!
                        </span>

                    </button>

                </div>

            </div>


            <!-- GAME INFO -->

            <div
                class="last-action"
                id="lastAction"
            ></div>


            <!-- COLOR PICKER -->

            <div
                class="color-overlay"
                id="colorOverlay"
            >

                <div class="color-box">

                    <div class="color-title">
                        CHOOSE COLOR
                    </div>

                    <div class="color-wheel">

                        <button
                            data-color="red"
                            class="choose-red"
                        >
                            RED
                        </button>

                        <button
                            data-color="yellow"
                            class="choose-yellow"
                        >
                            YELLOW
                        </button>

                        <button
                            data-color="green"
                            class="choose-green"
                        >
                            GREEN
                        </button>

                        <button
                            data-color="blue"
                            class="choose-blue"
                        >
                            BLUE
                        </button>

                    </div>

                </div>

            </div>


            <!-- WINNER -->

            <div
                class="winner-overlay"
                id="winnerOverlay"
            >

                <div class="winner-box">

                    <div class="winner-emoji">
                        🏆
                    </div>

                    <div
                        class="winner-title"
                        id="winnerTitle"
                    >
                        YOU WIN!
                    </div>

                    <div
                        class="winner-subtitle"
                        id="winnerSubtitle"
                    >
                        Congratulations!
                    </div>

                    <button
                        id="winnerLeave"
                    >
                        LEAVE GAME
                    </button>

                </div>

            </div>

        </div>

    `;


    document
        .getElementById("newDrawButton")
        .addEventListener(
            "click",
            drawCard
        );


    document
        .getElementById("newDrawPile")
        .addEventListener(
            "click",
            drawCard
        );


    document
        .getElementById("newUnoButton")
        .addEventListener(
            "click",
            callUno
        );


    document
        .getElementById("exitGame")
        .addEventListener(
            "click",
            leaveGame
        );


    document
        .getElementById("winnerLeave")
        .addEventListener(
            "click",
            leaveGame
        );


    document
        .querySelectorAll(
            ".color-box button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    chooseColor(
                        button.dataset.color
                    );

                }
            );
        });
}


/* =========================================================
   RENDER GAME
   ========================================================= */

function renderGame() {

    if (!state)
        return;


    renderOpponents();

    renderMyPlayer();

    renderHand();

    renderDiscard();

    renderTurn();

    renderColor();

    renderDirection();

    renderLastAction();

    renderWinner();
}


/* =========================================================
   MY PLAYER
   ========================================================= */

function renderMyPlayer() {

    const element =
        document.getElementById(
            "myPlayer"
        );


    if (!element)
        return;


    element.innerHTML = `

        <div class="my-avatar">
            ${getAvatar(playerName)}
        </div>

        <div class="my-name">
            ${escapeHTML(playerName)}
        </div>

        <div class="my-card-count">
            ${(state.hands[playerId] || []).length}
        </div>

    `;
}


/* =========================================================
   OPPONENTS
   ========================================================= */

function renderOpponents() {

    const container =
        document.getElementById(
            "opponentsZone"
        );


    if (!container)
        return;


    container.innerHTML =
        "";


    const opponents =
        players.filter(
            p =>
                p.id !== playerId
        );


    opponents.forEach(
        (player, index) => {

            const hand =
                state.hands[player.id] ||
                [];


            const isTurn =
                players[
                    state.currentPlayerIndex
                ]?.id === player.id;


            const opponent =
                document.createElement(
                    "div"
                );


            opponent.className =
                "opponent-seat";


            if (isTurn) {

                opponent.classList.add(
                    "opponent-turn"
                );
            }


            let backs = "";


            const numberOfBacks =
                Math.min(
                    hand.length,
                    6
                );


            for (
                let i = 0;
                i < numberOfBacks;
                i++
            ) {

                backs += `

                    <div
                        class="mini-card-back"
                        style="
                            --card-index:${i};
                        "
                    >
                        <span>UNO</span>
                    </div>

                `;
            }


            opponent.innerHTML = `

                <div class="opponent-avatar">
                    ${getAvatar(player.name)}

                    ${
                        isTurn
                        ? `<div class="turn-ring"></div>`
                        : ""
                    }
                </div>

                <div class="opponent-name">
                    ${escapeHTML(player.name)}
                </div>

                <div class="opponent-hand">
                    ${backs}
                </div>

                <div class="opponent-count">
                    ${hand.length}
                </div>

            `;


            container.appendChild(
                opponent
            );
        }
    );
}


/* =========================================================
   MY HAND
   ========================================================= */

function renderHand() {

    const container =
        document.getElementById(
            "newHand"
        );


    if (!container)
        return;


    container.innerHTML =
        "";


    const hand =
        state.hands[playerId] ||
        [];


    const currentPlayer =
        players[
            state.currentPlayerIndex
        ];


    const myTurn =
        currentPlayer?.id ===
        playerId;


    hand.forEach(
        (card, index) => {

            const element =
                document.createElement(
                    "button"
                );


            element.className =
                `uno-card
                 card-${card.color}`;


            if (
                myTurn &&
                canPlay(card)
            ) {

                element.classList.add(
                    "card-playable"
                );

            } else {

                element.classList.add(
                    "card-dim"
                );
            }


            element.style.setProperty(
                "--card-position",
                index
            );


            element.innerHTML = `

                <span class="card-corner top">
                    ${displayValue(card.value)}
                </span>

                <span class="card-oval">

                    <span class="card-main">
                        ${displayValue(card.value)}
                    </span>

                </span>

                <span class="card-corner bottom">
                    ${displayValue(card.value)}
                </span>

            `;


            element.addEventListener(
                "click",
                () => {

                    if (!myTurn) {

                        toast(
                            "Wait for your turn"
                        );

                        return;
                    }


                    if (
                        !canPlay(card)
                    ) {

                        toast(
                            "You can't play this card"
                        );

                        return;
                    }


                    playCard(index);
                }
            );


            container.appendChild(
                element
            );
        }
    );
}


/* =========================================================
   DISCARD
   ========================================================= */

function renderDiscard() {

    const container =
        document.getElementById(
            "newDiscardPile"
        );


    if (!container)
        return;


    const top =
        state.discard[
            state.discard.length - 1
        ];


    container.innerHTML =
        "";


    if (!top)
        return;


    const element =
        document.createElement(
            "div"
        );


    element.className =
        `uno-card center-card card-${top.color}`;


    element.innerHTML = `

        <span class="card-corner top">
            ${displayValue(top.value)}
        </span>

        <span class="card-oval">

            <span class="card-main">
                ${displayValue(top.value)}
            </span>

        </span>

        <span class="card-corner bottom">
            ${displayValue(top.value)}
        </span>

    `;


    container.appendChild(
        element
    );
}


/* =========================================================
   TURN
   ========================================================= */

function renderTurn() {

    const current =
        players[
            state.currentPlayerIndex
        ];


    const status =
        document.getElementById(
            "gameStatus"
        );


    const center =
        document.getElementById(
            "centerMessage"
        );


    if (!current)
        return;


    const mine =
        current.id === playerId;


    if (mine) {

        status.textContent =
            "YOUR TURN";

        status.className =
            "game-status my-turn";


        center.textContent =
            "YOUR TURN";

        center.className =
            "center-message my-turn-message";

    } else {

        status.textContent =
            `${current.name}'S TURN`;

        status.className =
            "game-status";


        center.textContent =
            `${current.name}'S TURN`;

        center.className =
            "center-message";
    }
}


/* =========================================================
   COLOR
   ========================================================= */

function renderColor() {

    const element =
        document.getElementById(
            "currentColor"
        );


    if (!element)
        return;


    const color =
        state.currentColor ||
        "red";


    element.dataset.color =
        color;


    element.innerHTML = `

        <span></span>

        <b>
            ${color.toUpperCase()}
        </b>

    `;
}


/* =========================================================
   DIRECTION
   ========================================================= */

function renderDirection() {

    const element =
        document.getElementById(
            "directionIndicator"
        );


    if (!element)
        return;


    element.textContent =
        state.direction === 1
            ? "↻"
            : "↺";
}


/* =========================================================
   LAST ACTION
   ========================================================= */

function renderLastAction() {

    const element =
        document.getElementById(
            "lastAction"
        );


    if (!element)
        return;


    element.textContent =
        state.lastAction || "";
}


/* =========================================================
   PLAYABILITY
   ========================================================= */

function canPlay(card) {

    if (!state)
        return false;


    if (
        state.pendingDraw > 0
    ) {

        return (
            card.value === "+2" ||
            card.value === "+4" ||
            card.value === "+10" ||
            card.value === "+20"
        );
    }


    const top =
        state.discard[
            state.discard.length - 1
        ];


    if (!top)
        return true;


    if (
        card.color === "wild"
    )
        return true;


    if (
        card.color ===
        state.currentColor
    )
        return true;


    if (
        card.value ===
        top.value
    )
        return true;


    return false;
}


/* =========================================================
   PLAY CARD
   ========================================================= */

async function playCard(index) {

    if (!state)
        return;


    const current =
        players[
            state.currentPlayerIndex
        ];


    if (
        !current ||
        current.id !== playerId
    ) {

        toast(
            "Wait for your turn"
        );

        return;
    }


    const hand =
        state.hands[playerId];


    const played =
        hand[index];


    if (!played)
        return;


    if (
        !canPlay(played)
    ) {

        toast(
            "You can't play that"
        );

        return;
    }


    hand.splice(
        index,
        1
    );


    state.discard.push(
        played
    );


    state.lastAction =
        `${playerName} played ${displayValue(played.value)}`;


    /*
       WIN
    */

    if (
        hand.length === 0
    ) {

        state.winner =
            playerId;


        state.lastAction =
            `${playerName} won the game!`;


        await saveState();

        renderGame();

        return;
    }


    /*
       Wild
    */

    if (
        played.color === "wild"
    ) {

        state.pendingWild =
            true;


        renderGame();

        openColorPicker();

        return;
    }


    /*
       ACTION
    */

    applyAction(
        played
    );


    nextTurn();


    await saveState();

    renderGame();
}


/* =========================================================
   ACTION EFFECT
   ========================================================= */

function applyAction(card) {

    if (
        card.value === "+2"
    ) {

        state.pendingDraw +=
            2;
    }


    if (
        card.value === "+4"
    ) {

        state.pendingDraw +=
            4;
    }


    if (
        card.value === "+10"
    ) {

        state.pendingDraw +=
            10;
    }


    if (
        card.value === "+20"
    ) {

        state.pendingDraw +=
            20;
    }


    if (
        card.value === "skip"
    ) {

        state.skipNext = true;
    }


    if (
        card.value === "reverse"
    ) {

        if (
            players.length === 2
        ) {

            state.skipNext = true;

        } else {

            state.direction *=
                -1;
        }
    }
}


/* =========================================================
   NEXT TURN
   ========================================================= */

function nextTurn() {

    let steps = 1;


    if (
        state.skipNext
    ) {

        steps = 2;

        state.skipNext =
            false;
    }


    const total =
        players.length;


    state.currentPlayerIndex =
        (
            state.currentPlayerIndex +
            state.direction *
            steps +
            total
        ) % total;


    state.uno = {};
}


/* =========================================================
   DRAW
   ========================================================= */

async function drawCard() {

    if (!state)
        return;


    if (state.winner) {

        toast(
            "Game is over"
        );

        return;
    }


    const current =
        players[
            state.currentPlayerIndex
        ];


    if (
        current?.id !== playerId
    ) {

        toast(
            "Wait for your turn"
        );

        return;
    }


    let amount =
        state.pendingDraw > 0
            ? state.pendingDraw
            : 1;


    state.pendingDraw = 0;


    let drawn = 0;


    for (
        let i = 0;
        i < amount;
        i++
    ) {

        if (
            state.deck.length === 0
        ) {

            refillDeck();
        }


        if (
            state.deck.length === 0
        )
            break;


        state.hands[playerId].push(
            state.deck.pop()
        );


        drawn++;
    }


    state.lastAction =
        `${playerName} drew ${drawn} card${drawn === 1 ? "" : "s"}`;


    nextTurn();


    await saveState();

    renderGame();


    toast(
        `Drew ${drawn} card${drawn === 1 ? "" : "s"}`
    );
}


/* =========================================================
   REFILL
   ========================================================= */

function refillDeck() {

    if (
        state.discard.length <= 1
    )
        return;


    const top =
        state.discard[
            state.discard.length - 1
        ];


    const old =
        state.discard.slice(
            0,
            -1
        );


    state.deck =
        shuffle(old);


    state.discard =
        [top];
}


/* =========================================================
   UNO
   ========================================================= */

async function callUno() {

    if (!state)
        return;


    const current =
        players[
            state.currentPlayerIndex
        ];


    if (
        current?.id !== playerId
    ) {

        toast(
            "It's not your turn"
        );

        return;
    }


    const hand =
        state.hands[playerId] ||
        [];


    if (
        hand.length > 2
    ) {

        toast(
            "UNO isn't available yet"
        );

        return;
    }


    state.uno[playerId] =
        true;


    state.lastAction =
        `${playerName} shouted UNO!`;


    await saveState();


    const button =
        document.getElementById(
            "newUnoButton"
        );


    if (button) {

        button.classList.add(
            "uno-hit"
        );


        setTimeout(
            () => {

                button.classList.remove(
                    "uno-hit"
                );

            },
            600
        );
    }


    toast(
        "🔥 UNO!"
    );


    renderGame();
}


/* =========================================================
   COLOR PICKER
   ========================================================= */

function openColorPicker() {

    colorPickerOpen =
        true;


    const overlay =
        document.getElementById(
            "colorOverlay"
        );


    if (overlay)
        overlay.classList.add(
            "open"
        );
}


async function chooseColor(color) {

    if (!colorPickerOpen)
        return;


    state.currentColor =
        color;


    state.pendingWild =
        false;


    colorPickerOpen =
        false;


    const overlay =
        document.getElementById(
            "colorOverlay"
        );


    if (overlay)
        overlay.classList.remove(
            "open"
        );


    state.lastAction =
        `${playerName} changed the color to ${color}`;


    nextTurn();


    await saveState();

    renderGame();
}


/* =========================================================
   WINNER
   ========================================================= */

function renderWinner() {

    const overlay =
        document.getElementById(
            "winnerOverlay"
        );


    if (!overlay)
        return;


    if (!state.winner) {

        overlay.classList.remove(
            "open"
        );

        return;
    }


    const winner =
        players.find(
            p =>
                p.id ===
                state.winner
        );


    if (!winner)
        return;


    const title =
        document.getElementById(
            "winnerTitle"
        );


    const subtitle =
        document.getElementById(
            "winnerSubtitle"
        );


    if (
        winner.id === playerId
    ) {

        title.textContent =
            "YOU WIN!";

        subtitle.textContent =
            "🏆 What a game!";

    } else {

        title.textContent =
            `${winner.name.toUpperCase()} WINS!`;

        subtitle.textContent =
            "Better luck next round!";
    }


    overlay.classList.add(
        "open"
    );
}


/* =========================================================
   LEAVE GAME
   ========================================================= */

async function leaveGame() {

    stopPolling();


    await supabaseClient
        .from("players")
        .delete()
        .eq(
            "id",
            playerId
        )
        .eq(
            "room_code",
            roomCode
        );


    roomCode = "";

    playerName = "";

    isHost = false;

    players = [];

    state = null;


    showScreen(home);
}


/* =========================================================
   OLD LEAVE BUTTON
   ========================================================= */

if (leaveButton) {

    leaveButton.addEventListener(
        "click",
        leaveGame
    );
}


/* =========================================================
   COPY CODE
   ========================================================= */

if (copyButton) {

    copyButton.addEventListener(
        "click",
        async () => {

            try {

                await navigator
                    .clipboard
                    .writeText(
                        roomCode
                    );

                toast(
                    "Room code copied!"
                );

            } catch {

                toast(
                    roomCode
                );
            }
        }
    );
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(text) {

    return String(text)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


/* =========================================================
   VISIBILITY
   ========================================================= */

document.addEventListener(
    "visibilitychange",
    async () => {

        if (
            !document.hidden &&
            roomCode
        ) {

            await sync();
        }
    }
);


/* =========================================================
   INITIAL
   ========================================================= */

showScreen(home);

console.log(
    "UNO Friends full app loaded"
);
