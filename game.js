/* =========================================================
   UNO FRIENDS — 2 to 8 PLAYERS
   Classic UNO + custom +10
   +2 / +4 / +10 stacking
   +4 playable at ANY time
   Wrong UNO / missed UNO caught = draw 2
   Continuous multiplayer sync + animations
   ========================================================= */

const SUPABASE_URL = "https://cumwoqdzpsidocqvulxd.supabase.co";
const SUPABASE_KEY = "sb_publishable_1ibhlNKv4SuESO57U1FJGw_s208R7FI";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let playerId =
    localStorage.getItem("uno_player_id") ||
    crypto.randomUUID();

localStorage.setItem(
    "uno_player_id",
    playerId
);

let playerName = "";
let roomCode = "";
let isHost = false;
let players = [];
let state = null;
let pollTimer = null;
let interfaceBuilt = false;
let lastRenderedState = "";

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
        .forEach(x =>
            x.classList.remove("active")
        );

    screen.classList.add("active");
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(text) {

    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   TOAST
   ========================================================= */

function toast(message) {

    let el =
        document.getElementById(
            "unoToast"
        );

    if (!el) {

        el =
            document.createElement(
                "div"
            );

        el.id =
            "unoToast";

        document.body.appendChild(el);
    }

    el.textContent =
        message;

    el.classList.add("show");

    clearTimeout(
        el._timer
    );

    el._timer =
        setTimeout(
            () =>
                el.classList.remove(
                    "show"
                ),
            2200
        );
}


/* =========================================================
   ROOM CODE
   ========================================================= */

function generateRoomCode() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    return Array
        .from(
            { length: 6 },
            () =>
                chars[
                    Math.floor(
                        Math.random() *
                        chars.length
                    )
                ]
        )
        .join("");
}


/* =========================================================
   SHUFFLE
   ========================================================= */

function shuffle(array) {

    const a =
        [...array];

    for (
        let i = a.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );

        [
            a[i],
            a[j]
        ] =
        [
            a[j],
            a[i]
        ];
    }

    return a;
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
        const character of name
    ) {

        number +=
            character.charCodeAt(0);
    }

    return avatars[
        number %
        avatars.length
    ];
}


/* =========================================================
   CARDS
   ========================================================= */

function makeCard(
    color,
    value
) {

    return {

        id:
            crypto.randomUUID(),

        color,

        value
    };
}


function cardText(value) {

    return {

        skip: "⊘",

        reverse: "↻",

        "+2": "+2",

        "+4": "+4",

        "+10": "+10",

        wild: "★"

    }[value] ?? value;
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


    for (
        const color of colors
    ) {

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


    /*
       Wild cards
       4 Wild
       4 +4
       4 custom +10
    */

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
    }


    return shuffle(deck);
}


/* =========================================================
   SUPABASE
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


    if (error)
        console.error(
            "Room:",
            error
        );


    return data;
}


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
                    ascending:
                        true
                }
            );


    if (error)
        console.error(
            "Players:",
            error
        );


    return data || [];
}


async function saveState() {

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
            "Save:",
            error
        );

        toast(
            "Connection problem"
        );

        return false;
    }


    return true;
}


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
   CREATE ROOM
   ========================================================= */

async function createRoom() {

    playerName =
        nameInput.value.trim();


    if (!playerName)
        return toast(
            "Enter your name"
        );


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
            error:
                roomError
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


        if (roomError)
            throw roomError;


        const {
            error:
                playerError
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


        if (playerError)
            throw playerError;


        roomCode =
            code;

        isHost =
            true;


        await enterLobby();


    } catch (error) {

        console.error(error);

        toast(
            "Couldn't create room"
        );


    } finally {

        createButton.disabled =
            false;
    }
}


/* =========================================================
   JOIN ROOM
   ========================================================= */

async function joinRoom() {

    playerName =
        nameInput.value.trim();


    roomCode =
        codeInput.value
            .trim()
            .toUpperCase();


    if (!playerName)
        return toast(
            "Enter your name"
        );


    if (
        roomCode.length !== 6
    )
        return toast(
            "Enter a valid room code"
        );


    joinButton.disabled =
        true;


    try {

        const room =
            await getRoom();


        if (!room)
            return toast(
                "Room not found"
            );


        if (
            room.game_started
        )
            return toast(
                "Game already started"
            );


        const ps =
            await getPlayers();


        if (
            ps.length >= 8
        )
            return toast(
                "Room is full (8 players)"
            );


        if (
            ps.some(
                p =>
                    p.name
                        .toLowerCase() ===
                    playerName
                        .toLowerCase()
            )
        )
            return toast(
                "Name already taken"
            );


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


        if (error)
            throw error;


        isHost =
            false;


        await enterLobby();


    } catch (error) {

        console.error(error);

        toast(
            "Couldn't join room"
        );


    } finally {

        joinButton.disabled =
            false;
    }
}


/* =========================================================
   LOBBY
   ========================================================= */

async function enterLobby() {

    showScreen(
        lobby
    );

    await refreshPlayers();

    startPolling();
}


async function refreshPlayers() {

    players =
        await getPlayers();

    renderLobby();
}


function renderLobby() {

    const codeElement =
        document.getElementById(
            "roomCode"
        );

    const countElement =
        document.getElementById(
            "count"
        );

    const list =
        document.getElementById(
            "players"
        );


    if (codeElement)
        codeElement.textContent =
            roomCode;


    if (countElement)
        countElement.textContent =
            `(${players.length}/8)`;


    if (!list)
        return;


    list.innerHTML =
        players
            .map(
                player => `

                    <div class="lobby-player">

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

                    </div>

                `
            )
            .join("");


    if (startButton)
        startButton.style.display =
            isHost
            ? "block"
            : "none";
}


/* =========================================================
   POLLING / SYNC
   ========================================================= */

function startPolling() {

    stopPolling();


    /*
       IMPORTANT:
       Never stop polling after
       game starts.
    */

    pollTimer =
        setInterval(
            syncEverything,
            650
        );
}


function stopPolling() {

    if (pollTimer)
        clearInterval(
            pollTimer
        );

    pollTimer =
        null;
}


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
           GAME STATE SYNC
        */

        if (
            room.game_started &&
            room.game_state
        ) {

            const incoming =
                room.game_state;


            const incomingString =
                JSON.stringify(
                    incoming
                );


            if (
                incomingString !==
                lastRenderedState
            ) {

                const oldState =
                    state;


                state =
                    incoming;


                lastRenderedState =
                    incomingString;


                if (
                    !game.classList.contains(
                        "active"
                    )
                ) {

                    showScreen(
                        game
                    );
                }


                if (
                    !interfaceBuilt
                ) {

                    buildGameInterface();

                    interfaceBuilt =
                        true;
                }


                renderGame(
                    oldState
                );
            }


            return;
        }


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
            "Sync:",
            error
        );
    }
}


/* =========================================================
   CREATE GAME STATE
   ========================================================= */

function createGameState() {

    let deck =
        createDeck();


    const hands = {};


    players.forEach(
        player => {

            hands[
                player.id
            ] = [];


            for (
                let i = 0;
                i < 7;
                i++
            ) {

                hands[
                    player.id
                ].push(
                    deck.pop()
                );
            }
        }
    );


    /*
       First card cannot be wild.
    */

    let first =
        deck.pop();


    while (
        first.color ===
        "wild"
    ) {

        deck.unshift(
            first
        );

        deck =
            shuffle(deck);

        first =
            deck.pop();
    }


    return {

        deck,

        discard: [
            first
        ],

        hands,

        currentPlayerIndex:
            0,

        direction:
            1,

        currentColor:
            first.color,

        pendingDraw:
            0,

        pendingStackType:
            null,

        pendingWild:
            false,

        winner:
            null,

        lastAction:
            "Game started",

        uno: {},

        turnDrawn:
            false,

        started:
            true
    };
}


/* =========================================================
   START GAME
   ========================================================= */

async function startGame() {

    if (!isHost)
        return;


    players =
        await getPlayers();


    if (
        players.length < 2
    )
        return toast(
            "Need at least 2 players"
        );


    if (
        players.length > 8
    )
        return toast(
            "Maximum 8 players"
        );


    startButton.disabled =
        true;


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


        if (error)
            throw error;


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
           Keep syncing forever.
        */

        startPolling();


    } catch (error) {

        console.error(error);

        toast(
            "Couldn't start game"
        );


    } finally {

        startButton.disabled =
            false;
    }
}


/* =========================================================
   GAME UI
   ========================================================= */

function buildGameInterface() {

    game.innerHTML = `

        <div
            class="rotate-overlay"
            id="rotateOverlay"
        >

            <div class="rotate-icon">
                📱↻
            </div>

            <h2>
                Rotate Your Phone
            </h2>

            <p>
                UNO is designed for landscape mode.
            </p>

        </div>


        <div class="uno-app">


            <div class="uno-topbar">

                <div class="uno-brand">
                    UNO
                </div>

                <div
                    class="game-status"
                    id="gameStatus"
                >
                    WAITING...
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

                <b>
                    RED
                </b>

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
                    ></div>

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
        .onclick =
        drawCard;


    document
        .getElementById(
            "newDrawPile"
        )
        .onclick =
        drawCard;


    document
        .getElementById(
            "newUnoButton"
        )
        .onclick =
        callUno;


    document
        .getElementById(
            "exitGame"
        )
        .onclick =
        leaveGame;


    document
        .getElementById(
            "winnerLeave"
        )
        .onclick =
        leaveGame;


    document
        .querySelectorAll(
            ".color-wheel button"
        )
        .forEach(
            button => {

                button.onclick =
                    () =>
                        chooseColor(
                            button.dataset.color
                        );
            }
        );
}


/* =========================================================
   RENDER GAME
   ========================================================= */

function renderGame(oldState = null) {

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

    renderControls();

    renderWinner();


    /*
       Draw animation when hand
       gets bigger from remote sync.
    */

    if (oldState) {

        const oldCount =
            oldState.hands?.[
                playerId
            ]?.length ?? 0;


        const newCount =
            state.hands?.[
                playerId
            ]?.length ?? 0;


        if (
            newCount >
            oldCount
        ) {

            animateDrawCards(
                Math.min(
                    newCount -
                    oldCount,
                    10
                )
            );
        }
    }
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
        state.hands[
            playerId
        ] || [];


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


    const opponents =
        players.filter(
            player =>
                player.id !==
                playerId
        );


    container.innerHTML =
        opponents
            .map(
                (
                    player,
                    index
                ) => {

                    const hand =
                        state.hands[
                            player.id
                        ] || [];


                    const isTurn =
                        players[
                            state.currentPlayerIndex
                        ]?.id ===
                        player.id;


                    const visible =
                        Math.min(
                            hand.length,
                            8
                        );


                    const backs =
                        Array
                            .from(
                                {
                                    length:
                                        visible
                                },
                                (
                                    _,
                                    n
                                ) => `

                                    <div
                                        class="mini-card-back"
                                        style="--card-index:${n}"
                                    >

                                        <span>
                                            UNO
                                        </span>

                                    </div>

                                `
                            )
                            .join("");


                    return `

                        <div
                            class="
                                opponent-seat
                                opponent-${index}
                            "
                        >

                            <div
                                class="
                                    opponent-avatar
                                    ${
                                        isTurn
                                        ? "active-turn"
                                        : ""
                                    }
                                "
                            >

                                ${getAvatar(
                                    player.name
                                )}

                                ${
                                    isTurn
                                    ? `
                                        <div class="turn-ring"></div>
                                      `
                                    : ""
                                }

                            </div>


                            <div class="opponent-name">

                                ${escapeHTML(
                                    player.name
                                )}

                            </div>


                            <div class="opponent-hand">

                                ${backs}

                            </div>


                            <div class="opponent-count">

                                ${hand.length}

                            </div>

                        </div>

                    `;
                }
            )
            .join("");
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


    const hand =
        state.hands[
            playerId
        ] || [];


    const myTurn =
        players[
            state.currentPlayerIndex
        ]?.id ===
        playerId;


    container.innerHTML =
        hand
            .map(
                (
                    card,
                    index
                ) => {

                    const playable =
                        myTurn &&
                        canPlay(card);


                    return `

                        <button

                            class="
                                uno-card
                                card-${card.color}
                                ${
                                    playable
                                    ? "card-playable"
                                    : "card-dim"
                                }
                            "

                            style="
                                --card-position:${index}
                            "

                            data-index="${index}"
                        >

                            <span
                                class="
                                    card-corner
                                    top
                                "
                            >

                                ${cardText(
                                    card.value
                                )}

                            </span>


                            <span class="card-oval">

                                <span class="card-main">

                                    ${cardText(
                                        card.value
                                    )}

                                </span>

                            </span>


                            <span
                                class="
                                    card-corner
                                    bottom
                                "
                            >

                                ${cardText(
                                    card.value
                                )}

                            </span>

                        </button>

                    `;
                }
            )
            .join("");


    container
        .querySelectorAll(
            ".uno-card"
        )
        .forEach(
            button => {

                button.onclick =
                    () =>
                        playCard(
                            Number(
                                button.dataset.index
                            )
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
            state.discard.length -
            1
        ];


    if (!top)
        return;


    container.innerHTML = `

        <div
            class="
                uno-card
                center-card
                card-${top.color}
                card-drop-in
            "
        >

            <span
                class="
                    card-corner
                    top
                "
            >
                ${cardText(
                    top.value
                )}
            </span>


            <span class="card-oval">

                <span class="card-main">

                    ${cardText(
                        top.value
                    )}

                </span>

            </span>


            <span
                class="
                    card-corner
                    bottom
                "
            >
                ${cardText(
                    top.value
                )}
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


    status.textContent =
        mine
        ? "YOUR TURN"
        : `${current.name.toUpperCase()}'S TURN`;


    status.className =
        `game-status ${
            mine
            ? "my-turn"
            : ""
        }`;


    center.textContent =
        mine
        ? "YOUR TURN"
        : `${current.name.toUpperCase()}'S TURN`;


    center.className =
        `center-message ${
            mine
            ? "my-turn"
            : ""
        }`;
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


    if (element) {

        element.textContent =
            state.direction === 1
            ? "↻"
            : "↺";
    }
}


/* =========================================================
   LAST ACTION
   ========================================================= */

function renderLastAction() {

    const element =
        document.getElementById(
            "lastAction"
        );


    if (element) {

        element.textContent =
            state.lastAction ||
            "";
    }
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


    const myTurn =
        players[
            state.currentPlayerIndex
        ]?.id ===
        playerId;


    draw.disabled =
        !myTurn ||
        !!state.winner ||
        state.turnDrawn ||
        state.pendingWild;


    uno.disabled =
        !myTurn ||
        !!state.winner;
}


/* =========================================================
   CAN PLAY
   ========================================================= */

function canPlay(card) {

    if (
        !state ||
        state.winner ||
        state.pendingWild
    )
        return false;


    /*
       USER RULE:
       +4 can ALWAYS be played.
    */

    if (
        card.value ===
        "+4"
    )
        return true;


    /*
       While stacking, only
       same penalty type stacks.
    */

    if (
        state.pendingDraw >
        0
    ) {

        return (
            card.value ===
            state.pendingStackType
        );
    }


    const top =
        state.discard[
            state.discard.length -
            1
        ];


    if (!top)
        return true;


    if (
        card.color ===
        "wild"
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
   DRAW CARD EFFECT
   ========================================================= */

function applyDrawCard(card) {

    if (
        card.value ===
        "+2"
    ) {

        state.pendingDraw +=
            2;

        state.pendingStackType =
            "+2";
    }


    if (
        card.value ===
        "+4"
    ) {

        state.pendingDraw +=
            4;

        state.pendingStackType =
            "+4";
    }


    if (
        card.value ===
        "+10"
    ) {

        state.pendingDraw +=
            10;

        state.pendingStackType =
            "+10";
    }
}


/* =========================================================
   NEXT TURN
   ========================================================= */

function advanceTurn(
    skip = false
) {

    const total =
        players.length;


    const steps =
        skip
        ? 2
        : 1;


    state.currentPlayerIndex =
        (
            state.currentPlayerIndex +
            state.direction *
            steps +
            total * 10
        ) %
        total;


    state.turnDrawn =
        false;
}


/* =========================================================
   REFILL DECK
   ========================================================= */

function refillDeck() {

    if (
        state.discard.length <=
        1
    )
        return;


    const top =
        state.discard[
            state.discard.length -
            1
        ];


    state.deck =
        shuffle(
            state.discard.slice(
                0,
                -1
            )
        );


    state.discard =
        [top];
}


/* =========================================================
   PLAY CARD
   ========================================================= */

async function playCard(index) {

    const current =
        players[
            state.currentPlayerIndex
        ];


    if (
        current?.id !==
        playerId
    )
        return toast(
            "Wait for your turn"
        );


    if (
        state.pendingWild
    )
        return toast(
            "Choose a color first"
        );


    const hand =
        state.hands[
            playerId
        ] || [];


    const card =
        hand[index];


    if (
        !card ||
        !canPlay(card)
    )
        return toast(
            "You can't play that"
        );


    const beforeCount =
        hand.length;


    hand.splice(
        index,
        1
    );


    state.discard.push(
        card
    );


    state.lastAction =
        `${playerName} played ${cardText(card.value)}`;


    animatePlayedCard(
        card
    );


    /*
       Player now has 1 card.
       They need to call UNO.
    */

    if (
        beforeCount === 2
    ) {

        state.uno[
            playerId
        ] = false;
    }


    /*
       WIN
    */

    if (
        hand.length ===
        0
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
       Wild / +4 / +10
       all choose a color.
    */

    if (
        card.color ===
        "wild"
    ) {

        state.pendingWild =
            true;


        /*
           Apply stacking
           immediately for
           +4 / +10.
        */

        if (
            card.value ===
            "+4" ||
            card.value ===
            "+10"
        ) {

            applyDrawCard(
                card
            );
        }


        await saveState();


        lastRenderedState =
            JSON.stringify(
                state
            );


        renderGame();


        openColorPicker();


        return;
    }


    let skip =
        false;


    if (
        card.value ===
        "+2"
    ) {

        applyDrawCard(
            card
        );
    }


    if (
        card.value ===
        "skip"
    ) {

        skip =
            true;
    }


    if (
        card.value ===
        "reverse"
    ) {

        if (
            players.length ===
            2
        ) {

            skip =
                true;

        } else {

            state.direction *=
                -1;
        }
    }


    advanceTurn(
        skip
    );


    if (
        beforeCount ===
        2
    ) {

        state.lastAction +=
            " — CALL UNO!";
    }


    await saveState();


    lastRenderedState =
        JSON.stringify(
            state
        );


    renderGame();
}


/* =========================================================
   DRAW
   ========================================================= */

async function drawCard() {

    const current =
        players[
            state.currentPlayerIndex
        ];


    if (
        current?.id !==
        playerId
    )
        return toast(
            "Wait for your turn"
        );


    if (
        state.turnDrawn
    )
        return toast(
            "You already drew this turn"
        );


    const amount =
        state.pendingDraw >
        0
        ? state.pendingDraw
        : 1;


    const wasPenalty =
        state.pendingDraw >
        0;


    state.pendingDraw =
        0;


    state.pendingStackType =
        null;


    const drawn =
        [];


    for (
        let i = 0;
        i < amount;
        i++
    ) {

        if (
            !state.deck.length
        ) {

            refillDeck();
        }


        if (
            !state.deck.length
        )
            break;


        const card =
            state.deck.pop();


        state.hands[
            playerId
        ].push(
            card
        );


        drawn.push(
            card
        );
    }


    state.lastAction =
        `${playerName} drew ${drawn.length} card${
            drawn.length === 1
            ? ""
            : "s"
        }`;


    animateDrawCards(
        drawn.length
    );


    /*
       Penalty draw ends turn.
       Normal draw keeps turn.
    */

    if (
        wasPenalty
    ) {

        advanceTurn(
            false
        );

    } else {

        state.turnDrawn =
            true;
    }


    await saveState();


    lastRenderedState =
        JSON.stringify(
            state
        );


    renderGame();


    /*
       Normal single draw:
       playable drawn card may
       be played.
    */

    if (
        !wasPenalty &&
        drawn.length === 1 &&
        canPlay(
            drawn[0]
        )
    ) {

        toast(
            "You drew a playable card"
        );
    }
}


/* =========================================================
   UNO
   ========================================================= */

async function callUno() {

    const current =
        players[
            state.currentPlayerIndex
        ];


    const hand =
        state.hands[
            playerId
        ] || [];


    if (
        current?.id !==
        playerId
    )
        return toast(
            "It's not your turn"
        );


    /*
       Correct UNO:
       exactly 1 card.
    */

    if (
        hand.length ===
        1
    ) {

        state.uno[
            playerId
        ] = true;


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
                () =>
                    button.classList.remove(
                        "uno-hit"
                    ),
                600
            );
        }


        renderGame();


        toast(
            "🔥 UNO!"
        );


        return;
    }


    /*
       Wrong UNO:
       draw 2.
    */

    for (
        let i = 0;
        i < 2;
        i++
    ) {

        if (
            !state.deck.length
        )
            refillDeck();


        if (
            state.deck.length
        ) {

            hand.push(
                state.deck.pop()
            );
        }
    }


    state.lastAction =
        `${playerName} called UNO incorrectly and drew 2!`;


    await saveState();


    lastRenderedState =
        JSON.stringify(
            state
        );


    renderGame();


    toast(
        "Wrong UNO! +2 cards"
    );
}


/* =========================================================
   COLOR PICKER
   ========================================================= */

function openColorPicker() {

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

    if (
        !state.pendingWild
    )
        return;


    state.currentColor =
        color;


    state.pendingWild =
        false;


    state.lastAction =
        `${playerName} chose ${color}`;


    document
        .getElementById(
            "colorOverlay"
        )
        ?.classList.remove(
            "open"
        );


    /*
       Wild card effects have
       already been applied.
    */

    advanceTurn(
        false
    );


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


    if (
        !state.winner
    ) {

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


    document
        .getElementById(
            "winnerTitle"
        )
        .textContent =
        winner.id === playerId
        ? "YOU WIN!"
        : `${winner.name.toUpperCase()} WINS!`;


    document
        .getElementById(
            "winnerSubtitle"
        )
        .textContent =
        winner.id === playerId
        ? "🏆 What a game!"
        : "Better luck next round!";


    overlay.classList.add(
        "open"
    );
}


/* =========================================================
   DRAW ANIMATION
   ========================================================= */

function animateDrawCards(
    count
) {

    if (!count)
        return;


    const source =
        document.getElementById(
            "newDrawPile"
        );


    const target =
        document.getElementById(
            "newHand"
        );


    if (
        !source ||
        !target
    )
        return;


    const s =
        source.getBoundingClientRect();


    const t =
        target.getBoundingClientRect();


    for (
        let i = 0;
        i < Math.min(
            count,
            10
        );
        i++
    ) {

        const flyer =
            document.createElement(
                "div"
            );


        flyer.className =
            "flying-card";


        flyer.innerHTML =
            "<span>UNO</span>";


        flyer.style.left =
            `${
                s.left +
                s.width / 2 -
                27
            }px`;


        flyer.style.top =
            `${
                s.top +
                s.height / 2 -
                38
            }px`;


        document.body.appendChild(
            flyer
        );


        const dx =
            t.left +
            t.width / 2 -
            (
                s.left +
                s.width / 2
            );


        const dy =
            t.top +
            t.height / 2 -
            (
                s.top +
                s.height / 2
            );


        setTimeout(
            () => {

                flyer.style.transform =
                    `
                        translate(
                            ${
                                dx +
                                i * 7
                            }px,
                            ${
                                dy +
                                i * 2
                            }px
                        )
                        rotate(
                            ${
                                i % 2
                                ? 12
                                : -12
                            }deg
                        )
                        scale(.72)
                    `;


                flyer.style.opacity =
                    "0.05";

            },
            20 +
            i * 55
        );


        setTimeout(
            () =>
                flyer.remove(),
            850 +
            i * 55
        );
    }
}


/* =========================================================
   PLAY ANIMATION
   ========================================================= */

function animatePlayedCard(
    card
) {

    const hand =
        document.getElementById(
            "newHand"
        );


    const discard =
        document.getElementById(
            "newDiscardPile"
        );


    if (
        !hand ||
        !discard
    )
        return;


    const source =
        hand.getBoundingClientRect();


    const target =
        discard.getBoundingClientRect();


    const flyer =
        document.createElement(
            "div"
        );


    flyer.className =
        `
            flying-card
            played-flying
            card-${card.color}
        `;


    flyer.innerHTML =
        `
            <span>
                ${cardText(
                    card.value
                )}
            </span>
        `;


    flyer.style.left =
        `${
            source.left +
            source.width / 2 -
            27
        }px`;


    flyer.style.top =
        `${
            source.top +
            source.height / 2 -
            38
        }px`;


    document.body.appendChild(
        flyer
    );


    requestAnimationFrame(
        () => {

            flyer.style.transform =
                `
                    translate(
                        ${
                            target.left -
                            source.left
                        }px,
                        ${
                            target.top -
                            source.top
                        }px
                    )
                    rotate(360deg)
                    scale(.85)
                `;


            flyer.style.opacity =
                "0";
        }
    );


    setTimeout(
        () =>
            flyer.remove(),
        650
    );
}


/* =========================================================
   LEAVE
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
   BUTTONS
   ========================================================= */

createButton?.addEventListener(
    "click",
    createRoom
);


joinButton?.addEventListener(
    "click",
    joinRoom
);


startButton?.addEventListener(
    "click",
    startGame
);


leaveButton?.addEventListener(
    "click",
    leaveGame
);


copyButton?.addEventListener(
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


/* =========================================================
   ENTER KEY
   ========================================================= */

nameInput?.addEventListener(
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


codeInput?.addEventListener(
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


/* =========================================================
   VISIBILITY
   ========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            !document.hidden &&
            roomCode
        ) {

            syncEverything();
        }
    }
);


/* =========================================================
   START
   ========================================================= */

showScreen(
    home
);

console.log(
    "UNO Friends — 8 player multiplayer loaded"
);
