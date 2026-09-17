/* =========================================================
   UNO FRIENDS
   COMPLETE MULTIPLAYER GAME.JS
   Continuous Supabase synchronization
   ========================================================= */


/* =========================================================
   SUPABASE
   ========================================================= */

const SUPABASE_URL =
    "https://cumwoqdzpsidocqvulxd.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_1ibhlNKv4SuESO57U1FJGw_s208R7FI";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


/* =========================================================
   PLAYER / ROOM
   ========================================================= */

let playerId = crypto.randomUUID();

let playerName = "";
let roomCode = "";

let isHost = false;

let players = [];

let state = null;

let pollTimer = null;

let interfaceBuilt = false;

let colorPickerOpen = false;

let lastRenderedState = "";


/* =========================================================
   DOM
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
   SCREEN
   ========================================================= */

function showScreen(screen) {

    document
        .querySelectorAll(".screen")
        .forEach(element => {

            element.classList.remove(
                "active"
            );
        });

    screen.classList.add(
        "active"
    );
}


/* =========================================================
   TOAST
   ========================================================= */

function toast(message) {

    let element =
        document.getElementById(
            "unoToast"
        );


    if (!element) {

        element =
            document.createElement(
                "div"
            );

        element.id =
            "unoToast";

        document.body.appendChild(
            element
        );
    }


    element.textContent =
        message;

    element.classList.add(
        "show"
    );


    clearTimeout(
        element.timer
    );


    element.timer =
        setTimeout(
            () => {

                element.classList.remove(
                    "show"
                );

            },
            2300
        );
}


/* =========================================================
   ROOM CODE
   ========================================================= */

function generateRoomCode() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let result = "";

    for (
        let i = 0;
        i < 6;
        i++
    ) {

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

    let number = 0;


    for (
        let i = 0;
        i < name.length;
        i++
    ) {

        number +=
            name.charCodeAt(i);
    }


    return avatars[
        number % avatars.length
    ];
}


/* =========================================================
   CARD
   ========================================================= */

function makeCard(color, value) {

    return {

        id:
            crypto.randomUUID(),

        color,

        value
    };
}


/* =========================================================
   CREATE DECK
   ========================================================= */

function createDeck() {

    const deck = [];

    const colors = [
        "red",
        "yellow",
        "green",
        "blue"
    ];


    colors.forEach(
        color => {

            deck.push(
                makeCard(
                    color,
                    "0"
                )
            );


            for (
                let n = 1;
                n <= 9;
                n++
            ) {

                deck.push(
                    makeCard(
                        color,
                        String(n)
                    )
                );

                deck.push(
                    makeCard(
                        color,
                        String(n)
                    )
                );
            }


            for (
                let i = 0;
                i < 2;
                i++
            ) {

                deck.push(
                    makeCard(
                        color,
                        "skip"
                    )
                );

                deck.push(
                    makeCard(
                        color,
                        "reverse"
                    )
                );

                deck.push(
                    makeCard(
                        color,
                        "+2"
                    )
                );
            }

        }
    );


    for (
        let i = 0;
        i < 4;
        i++
    ) {

        deck.push(
            makeCard(
                "wild",
                "wild"
            )
        );

        deck.push(
            makeCard(
                "wild",
                "+4"
            )
        );

        deck.push(
            makeCard(
                "wild",
                "+10"
            )
        );

        deck.push(
            makeCard(
                "wild",
                "+20"
            )
        );
    }


    return shuffle(deck);
}


/* =========================================================
   CARD TEXT
   ========================================================= */

function cardText(value) {

    if (value === "skip")
        return "⊘";

    if (value === "reverse")
        return "↻";

    return value;
}


/* =========================================================
   GET ROOM
   ========================================================= */

async function getRoom() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("rooms")
            .select("*")
            .eq(
                "code",
                roomCode
            )
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


/* =========================================================
   GET PLAYERS
   ========================================================= */

async function getPlayers() {

    const {
        data,
        error
    } =
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

        console.error(
            "Players error:",
            error
        );

        return [];
    }


    return data || [];
}


/* =========================================================
   SAVE STATE
   ========================================================= */

async function saveState() {

    if (!roomCode || !state)
        return false;


    const {
        error
    } =
        await supabaseClient
            .from("rooms")
            .update({

                game_state:
                    state

            })
            .eq(
                "code",
                roomCode
            );


    if (error) {

        console.error(
            "Save state error:",
            error
        );

        toast(
            "Connection problem"
        );

        return false;
    }


    return true;
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


    createButton.disabled =
        true;


    try {

        let code =
            generateRoomCode();


        while (
            await roomExists(code)
        ) {

            code =
                generateRoomCode();
        }


        const {
            error: roomError
        } =
            await supabaseClient
                .from("rooms")
                .insert({

                    code,

                    game_started:
                        false,

                    game_state:
                        null

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

                    id:
                        playerId,

                    room_code:
                        code,

                    name:
                        playerName,

                    is_host:
                        true

                });


        if (playerError) {

            console.error(
                playerError
            );

            toast(
                "Couldn't enter room"
            );

            return;
        }


        roomCode =
            code;

        isHost =
            true;


        await enterLobby();


    } finally {

        createButton.disabled =
            false;
    }
}


/* =========================================================
   ROOM EXISTS
   ========================================================= */

async function roomExists(code) {

    const {
        data
    } =
        await supabaseClient
            .from("rooms")
            .select("code")
            .eq(
                "code",
                code
            )
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
            "Enter a valid room code"
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
                "Room not found"
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


        const roomPlayers =
            await getPlayers();


        if (
            roomPlayers.length >= 6
        ) {

            toast(
                "Room is full"
            );

            return;
        }


        const duplicate =
            roomPlayers.some(
                p =>
                    p.name
                        .toLowerCase() ===
                    playerName
                        .toLowerCase()
            );


        if (duplicate) {

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

                    id:
                        playerId,

                    room_code:
                        roomCode,

                    name:
                        playerName,

                    is_host:
                        false

                });


        if (error) {

            console.error(
                error
            );

            toast(
                "Couldn't join room"
            );

            return;
        }


        isHost =
            false;


        await enterLobby();


    } finally {

        joinButton.disabled =
            false;
    }
}


/* =========================================================
   ENTER LOBBY
   ========================================================= */

async function enterLobby() {

    showScreen(
        lobby
    );


    await refreshPlayers();

    startPolling();
}


/* =========================================================
   REFRESH PLAYERS
   ========================================================= */

async function refreshPlayers() {

    players =
        await getPlayers();

    renderLobby();
}


/* =========================================================
   POLLING
   ========================================================= */

function startPolling() {

    stopPolling();


    /*
       IMPORTANT:
       Polling NEVER stops when game starts.
       Every device keeps receiving state updates.
    */

    pollTimer =
        setInterval(
            syncEverything,
            500
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
   MASTER SYNC
   ========================================================= */

async function syncEverything() {

    if (!roomCode)
        return;


    try {

        const room =
            await getRoom();


        if (!room) {

            stopPolling();

            showScreen(
                home
            );

            toast(
                "Room no longer exists"
            );

            return;
        }


        const latestPlayers =
            await getPlayers();


        /*
           Update players if changed.
        */

        const playersChanged =
            JSON.stringify(
                latestPlayers
            ) !==
            JSON.stringify(
                players
            );


        players =
            latestPlayers;


        /*
           GAME STARTED
        */

        if (
            room.game_started &&
            room.game_state
        ) {

            const newState =
                room.game_state;


            const newStateString =
                JSON.stringify(
                    newState
                );


            /*
               Only update when
               state actually changed.
            */

            if (
                newStateString !==
                lastRenderedState
            ) {

                state =
                    newState;

                lastRenderedState =
                    newStateString;


                if (
                    !game.classList.contains(
                        "active"
                    )
                ) {

                    showScreen(
                        game
                    );
                }


                /*
                   Build UI only ONCE.
                */

                if (
                    !interfaceBuilt
                ) {

                    buildGameInterface();

                    interfaceBuilt =
                        true;
                }


                renderGame();
            }


            return;
        }


        /*
           LOBBY
        */

        if (
            lobby.classList.contains(
                "active"
            ) &&
            playersChanged
        ) {

            renderLobby();
        }


    } catch (error) {

        console.error(
            "Sync error:",
            error
        );
    }
}


/* =========================================================
   LOBBY RENDER
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


    if (codeElement) {

        codeElement.textContent =
            roomCode;
    }


    if (countElement) {

        countElement.textContent =
            `(${players.length}/6)`;
    }


    if (!playersElement)
        return;


    playersElement.innerHTML =
        "";


    players.forEach(
        player => {

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
                        ${
                            player.is_host
                            ? "HOST"
                            : "PLAYER"
                        }
                    </small>

                </div>

                ${
                    player.id === playerId
                    ? `
                        <span class="lobby-you">
                            YOU
                        </span>
                    `
                    : ""
                }

            `;


            playersElement.appendChild(
                row
            );
        }
    );


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
        await getPlayers();


    if (
        players.length < 2
    ) {

        toast(
            "Need at least 2 players"
        );

        return;
    }


    if (
        players.length > 6
    ) {

        toast(
            "Maximum 6 players"
        );

        return;
    }


    startButton.disabled =
        true;


    startButton.textContent =
        "STARTING...";


    try {

        const newState =
            createGameState();


        const {
            error
        } =
            await supabaseClient
                .from("rooms")
                .update({

                    game_started:
                        true,

                    game_state:
                        newState

                })
                .eq(
                    "code",
                    roomCode
                );


        if (error) {

            console.error(
                error
            );

            toast(
                "Couldn't start game"
            );

            return;
        }


        state =
            newState;


        lastRenderedState =
            JSON.stringify(
                newState
            );


        showScreen(
            game
        );


        if (
            !interfaceBuilt
        ) {

            buildGameInterface();

            interfaceBuilt =
                true;
        }


        renderGame();


        /*
           IMPORTANT:
           Keep polling alive.
        */

        startPolling();


    } finally {

        startButton.disabled =
            false;

        startButton.textContent =
            "START GAME";
    }
}


/* =========================================================
   INITIAL GAME STATE
   ========================================================= */

function createGameState() {

    let deck =
        createDeck();


    const hands = {};


    players.forEach(
        player => {

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
        }
    );


    /*
       Start with a non-wild card.
    */

    let firstCard =
        deck.pop();


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

        currentPlayerIndex:
            0,

        direction:
            1,

        currentColor:
            firstCard.color,

        pendingDraw:
            0,

        skipNext:
            false,

        pendingWild:
            false,

        winner:
            null,

        lastAction:
            "Game started",

        uno: {},

        started:
            true
    };
}


/* =========================================================
   BUILD GAME UI
   ========================================================= */

function buildGameInterface() {

    game.innerHTML = `

        <div class="uno-app">

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


            <div
                class="opponents-zone"
                id="opponentsZone"
            ></div>


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


            <div
                class="current-color"
                id="currentColor"
            >
                <span></span>
                <b>RED</b>
            </div>


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


            <div
                class="last-action"
                id="lastAction"
            ></div>


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
                            class="choose-red"
                            data-color="red"
                        >
                            RED
                        </button>

                        <button
                            class="choose-yellow"
                            data-color="yellow"
                        >
                            YELLOW
                        </button>

                        <button
                            class="choose-green"
                            data-color="green"
                        >
                            GREEN
                        </button>

                        <button
                            class="choose-blue"
                            data-color="blue"
                        >
                            BLUE
                        </button>

                    </div>

                </div>

            </div>


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
        .getElementById(
            "newDrawButton"
        )
        .addEventListener(
            "click",
            drawCard
        );


    document
        .getElementById(
            "newDrawPile"
        )
        .addEventListener(
            "click",
            drawCard
        );


    document
        .getElementById(
            "newUnoButton"
        )
        .addEventListener(
            "click",
            callUno
        );


    document
        .getElementById(
            "exitGame"
        )
        .addEventListener(
            "click",
            leaveGame
        );


    document
        .getElementById(
            "winnerLeave"
        )
        .addEventListener(
            "click",
            leaveGame
        );


    document
        .querySelectorAll(
            ".color-wheel button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        chooseColor(
                            button.dataset.color
                        );
                    }
                );
            }
        );
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

    renderControls();
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


    const hand =
        state.hands[playerId] ||
        [];


    element.innerHTML = `

        <div class="my-avatar">
            ${getAvatar(playerName)}
        </div>

        <div class="my-name">
            ${escapeHTML(playerName)}
        </div>

        <div class="my-card-count">
            ${hand.length}
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


    players
        .filter(
            p =>
                p.id !== playerId
        )
        .forEach(
            player => {

                const hand =
                    state.hands[
                        player.id
                    ] || [];


                const current =
                    players[
                        state.currentPlayerIndex
                    ];


                const isTurn =
                    current &&
                    current.id ===
                    player.id;


                const element =
                    document.createElement(
                        "div"
                    );


                element.className =
                    "opponent-seat";


                if (isTurn) {

                    element.classList.add(
                        "opponent-turn"
                    );
                }


                let cards = "";


                const visible =
                    Math.min(
                        hand.length,
                        6
                    );


                for (
                    let i = 0;
                    i < visible;
                    i++
                ) {

                    cards += `

                        <div
                            class="mini-card-back"
                            style="
                                --card-index:${i};
                            "
                        >

                            <span>
                                UNO
                            </span>

                        </div>

                    `;
                }


                element.innerHTML = `

                    <div class="opponent-avatar">

                        ${getAvatar(player.name)}

                        ${
                            isTurn
                            ? `
                                <div class="turn-ring">
                                </div>
                            `
                            : ""
                        }

                    </div>

                    <div class="opponent-name">
                        ${escapeHTML(player.name)}
                    </div>

                    <div class="opponent-hand">
                        ${cards}
                    </div>

                    <div class="opponent-count">
                        ${hand.length}
                    </div>

                `;


                container.appendChild(
                    element
                );
            }
        );
}


/* =========================================================
   HAND
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


    const current =
        players[
            state.currentPlayerIndex
        ];


    const myTurn =
        current &&
        current.id ===
        playerId;


    hand.forEach(
        (playedCard, index) => {

            const element =
                document.createElement(
                    "button"
                );


            element.className =
                `uno-card card-${playedCard.color}`;


            const playable =
                myTurn &&
                canPlay(
                    playedCard
                );


            if (playable) {

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
                    ${cardText(playedCard.value)}
                </span>

                <span class="card-oval">

                    <span class="card-main">
                        ${cardText(playedCard.value)}
                    </span>

                </span>

                <span class="card-corner bottom">
                    ${cardText(playedCard.value)}
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


                    if (!playable) {

                        toast(
                            "You can't play that"
                        );

                        return;
                    }


                    playCard(
                        index
                    );
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


    if (!top)
        return;


    container.innerHTML = `

        <div
            class="
                uno-card
                center-card
                card-${top.color}
            "
        >

            <span class="card-corner top">
                ${cardText(top.value)}
            </span>

            <span class="card-oval">

                <span class="card-main">
                    ${cardText(top.value)}
                </span>

            </span>

            <span class="card-corner bottom">
                ${cardText(top.value)}
            </span>

        </div>

    `;
}


/* =========================================================
   TURN
   ========================================================= */

function renderTurn() {

    const current =
        players[
            state.currentPlayerIndex
        ];


    if (!current)
        return;


    const mine =
        current.id ===
        playerId;


    const status =
        document.getElementById(
            "gameStatus"
        );


    const center =
        document.getElementById(
            "centerMessage"
        );


    if (mine) {

        status.textContent =
            "YOUR TURN";

        status.className =
            "game-status my-turn";


        center.textContent =
            "YOUR TURN";

        center.className =
            "center-message my-turn";

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
        state.lastAction ||
        "";
}


/* =========================================================
   CONTROLS
   ========================================================= */

function renderControls() {

    const draw =
        document.getElementById(
            "newDrawButton"
        );


    const uno =
        document.getElementById(
            "newUnoButton"
        );


    if (!draw || !uno)
        return;


    const current =
        players[
            state.currentPlayerIndex
        ];


    const myTurn =
        current &&
        current.id ===
        playerId;


    draw.disabled =
        !myTurn ||
        !!state.winner;


    const hand =
        state.hands[playerId] ||
        [];


    uno.disabled =
        !myTurn ||
        !!state.winner ||
        hand.length > 2;
}


/* =========================================================
   CAN PLAY
   ========================================================= */

function canPlay(card) {

    if (!state)
        return false;


    /*
       Stacking draw cards.
    */

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


    if (!canPlay(played)) {

        toast(
            "You can't play that"
        );

        return;
    }


    /*
       Remove from hand.
    */

    hand.splice(
        index,
        1
    );


    /*
       Put onto discard.
    */

    state.discard.push(
        played
    );


    state.lastAction =
        `${playerName} played ${cardText(played.value)}`;


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

        lastRenderedState =
            JSON.stringify(
                state
            );


        renderGame();

        return;
    }


    /*
       Wild card.
    */

    if (
        played.color === "wild"
    ) {

        state.pendingWild =
            true;


        /*
           Save immediately so
           other devices know a
           wild was played.
        */

        await saveState();


        lastRenderedState =
            JSON.stringify(
                state
            );


        renderGame();


        openColorPicker();

        return;
    }


    /*
       Normal action.
    */

    applyAction(
        played
    );


    nextTurn();


    await saveState();


    lastRenderedState =
        JSON.stringify(
            state
        );


    renderGame();
}


/* =========================================================
   ACTION
   ========================================================= */

function applyAction(card) {

    switch (
        card.value
    ) {

        case "+2":

            state.pendingDraw += 2;

            break;


        case "+4":

            state.pendingDraw += 4;

            break;


        case "+10":

            state.pendingDraw += 10;

            break;


        case "+20":

            state.pendingDraw += 20;

            break;


        case "skip":

            state.skipNext =
                true;

            break;


        case "reverse":

            if (
                players.length === 2
            ) {

                state.skipNext =
                    true;

            } else {

                state.direction *=
                    -1;
            }

            break;
    }
}


/* =========================================================
   NEXT TURN
   ========================================================= */

function nextTurn() {

    let steps =
        1;


    if (
        state.skipNext
    ) {

        steps =
            2;

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
        !current ||
        current.id !== playerId
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


    state.pendingDraw =
        0;


    let drawn =
        0;


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


        state.hands[
            playerId
        ].push(
            state.deck.pop()
        );


        drawn++;
    }


    state.lastAction =
        `${playerName} drew ${drawn} card${drawn === 1 ? "" : "s"}`;


    nextTurn();


    await saveState();


    lastRenderedState =
        JSON.stringify(
            state
        );


    renderGame();


    toast(
        `Drew ${drawn} card${drawn === 1 ? "" : "s"}`
    );
}


/* =========================================================
   REFILL DECK
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


    const oldCards =
        state.discard.slice(
            0,
            -1
        );


    state.deck =
        shuffle(
            oldCards
        );


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
        !current ||
        current.id !== playerId
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


    lastRenderedState =
        JSON.stringify(
            state
        );


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


    if (overlay) {

        overlay.classList.add(
            "open"
        );
    }
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


    if (overlay) {

        overlay.classList.remove(
            "open"
        );
    }


    state.lastAction =
        `${playerName} changed the color to ${color}`;


    nextTurn();


    await saveState();


    lastRenderedState =
        JSON.stringify(
            state
        );


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
        winner.id ===
        playerId
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


    if (roomCode) {

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
    }


    roomCode = "";

    playerName = "";

    isHost = false;

    players = [];

    state = null;

    interfaceBuilt =
        false;

    lastRenderedState =
        "";


    showScreen(
        home
    );
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
   COPY ROOM CODE
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
   ENTER KEY
   ========================================================= */

if (nameInput) {

    nameInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                codeInput.focus();
            }
        }
    );
}


if (codeInput) {

    codeInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                joinButton.click();
            }
        }
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

            await syncEverything();
        }
    }
);


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
   INITIAL
   ========================================================= */

showScreen(
    home
);

console.log(
    "UNO Friends multiplayer loaded"
);
