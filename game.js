// ============================================================
// UNO FRIENDS - MULTIPLAYER GAME
// ============================================================

// ---------------- SUPABASE ----------------

const SUPABASE_URL = "https://cumwoqdzpsidocqvulxd.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_1ibhlNKv4SuESO57U1FJGw_s208R7FI";

const { createClient } = window.supabase;

const db = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ---------------- PLAYER ----------------

// IMPORTANT:
// Fresh ID every page session.
// This prevents 409 duplicate-player errors.

const playerId = crypto.randomUUID();

let playerName = "";
let roomCode = "";
let isHost = false;

let state = null;
let pollTimer = null;

let turnDrawn = false;
let pendingWild = false;


// ============================================================
// DOM HELPERS
// ============================================================

function $(id) {
    return document.getElementById(id);
}


function showScreen(id) {

    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });

    const target = $(id);

    if (target) {
        target.classList.add("active");
    }
}


function toast(message) {

    const el = $("toast");

    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    setTimeout(() => {
        el.classList.remove("show");
    }, 2500);
}


function generateRoomCode() {

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }

    return code;
}


// ============================================================
// DECK
// ============================================================

function createDeck() {

    const deck = [];

    const colors = [
        "red",
        "yellow",
        "green",
        "blue"
    ];

    for (const color of colors) {

        // 0
        deck.push({
            id: crypto.randomUUID(),
            color,
            value: "0"
        });

        // 1-9 twice
        for (let n = 1; n <= 9; n++) {

            deck.push({
                id: crypto.randomUUID(),
                color,
                value: String(n)
            });

            deck.push({
                id: crypto.randomUUID(),
                color,
                value: String(n)
            });
        }

        // Skip
        deck.push({
            id: crypto.randomUUID(),
            color,
            value: "skip"
        });

        deck.push({
            id: crypto.randomUUID(),
            color,
            value: "skip"
        });

        // Reverse
        deck.push({
            id: crypto.randomUUID(),
            color,
            value: "reverse"
        });

        deck.push({
            id: crypto.randomUUID(),
            color,
            value: "reverse"
        });

        // +2
        deck.push({
            id: crypto.randomUUID(),
            color,
            value: "+2"
        });

        deck.push({
            id: crypto.randomUUID(),
            color,
            value: "+2"
        });
    }


    // 4 Wild
    for (let i = 0; i < 4; i++) {

        deck.push({
            id: crypto.randomUUID(),
            color: "wild",
            value: "wild"
        });
    }


    // 4 Wild +4
    for (let i = 0; i < 4; i++) {

        deck.push({
            id: crypto.randomUUID(),
            color: "wild",
            value: "+4"
        });
    }


    // 4 custom +10
    for (let i = 0; i < 4; i++) {

        deck.push({
            id: crypto.randomUUID(),
            color: "wild",
            value: "+10"
        });
    }


    return shuffle(deck);
}


function shuffle(array) {

    const arr = [...array];

    for (let i = arr.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr;
}


// ============================================================
// ROOM CREATION
// ============================================================

async function createRoom() {

    playerName = $("name")?.value.trim();

    if (!playerName) {
        toast("Enter your name first");
        return;
    }

    if (playerName.length > 15) {
        toast("Name is too long");
        return;
    }


    roomCode = generateRoomCode();


    // Make sure code doesn't already exist
    let exists = true;

    while (exists) {

        const { data } = await db
            .from("rooms")
            .select("code")
            .eq("code", roomCode)
            .maybeSingle();

        if (!data) {
            exists = false;
        } else {
            roomCode = generateRoomCode();
        }
    }


    const { error: roomError } = await db
        .from("rooms")
        .insert({
            code: roomCode,
            game_started: false,
            game_state: null
        });


    if (roomError) {

        console.error("ROOM CREATE ERROR:", roomError);

        toast("Could not create room");

        return;
    }


    isHost = true;


    const { error: playerError } = await db
        .from("players")
        .insert({
            id: playerId,
            room_code: roomCode,
            name: playerName,
            is_host: true
        });


    if (playerError) {

        console.error("PLAYER CREATE ERROR:", playerError);

        // Clean up room if player couldn't be added
        await db
            .from("rooms")
            .delete()
            .eq("code", roomCode);

        toast("Could not enter room");

        return;
    }


    await createPlayerHand();


    openLobby();

    startPolling();
}


// ============================================================
// JOIN ROOM
// ============================================================

async function joinRoom() {

    playerName = $("name")?.value.trim();

    const enteredCode =
        $("code")?.value.trim().toUpperCase();


    if (!playerName) {
        toast("Enter your name first");
        return;
    }


    if (!enteredCode) {
        toast("Enter room code");
        return;
    }


    if (enteredCode.length !== 6) {
        toast("Room code must be 6 characters");
        return;
    }


    roomCode = enteredCode;


    const {
        data: room,
        error: roomError
    } = await db
        .from("rooms")
        .select("*")
        .eq("code", roomCode)
        .maybeSingle();


    if (roomError) {

        console.error(roomError);

        toast("Could not find room");

        return;
    }


    if (!room) {

        toast("Room doesn't exist");

        return;
    }


    if (room.game_started) {

        toast("Game has already started");

        return;
    }


    const {
        data: existingPlayers,
        error: countError
    } = await db
        .from("players")
        .select("id")
        .eq("room_code", roomCode);


    if (countError) {

        console.error(countError);

        toast("Could not check room");

        return;
    }


    if ((existingPlayers || []).length >= 8) {

        toast("Room is full — maximum 8 players");

        return;
    }


    const { error: playerError } = await db
        .from("players")
        .insert({
            id: playerId,
            room_code: roomCode,
            name: playerName,
            is_host: false
        });


    if (playerError) {

        console.error("PLAYER JOIN ERROR:", playerError);

        toast("Could not join room");

        return;
    }


    isHost = false;


    await createPlayerHand();


    openLobby();

    startPolling();
}


// ============================================================
// PLAYER HAND
// ============================================================

async function createPlayerHand() {

    const { error } = await db
        .from("player_hands")
        .insert({
            player_id: playerId,
            room_code: roomCode,
            hand: []
        });


    if (error && error.code !== "23505") {
        console.error("HAND CREATE ERROR:", error);
    }
}


// ============================================================
// LOBBY
// ============================================================

function openLobby() {

    showScreen("lobby");

    const roomCodeEl = $("roomCode");

    if (roomCodeEl) {
        roomCodeEl.textContent = roomCode;
    }

    updateLobby();
}


async function updateLobby() {

    if (!roomCode) return;


    const {
        data: players,
        error
    } = await db
        .from("players")
        .select("*")
        .eq("room_code", roomCode)
        .order("joined_at", {
            ascending: true
        });


    if (error) {

        console.error("LOBBY ERROR:", error);

        return;
    }


    const container = $("players");

    const count = $("count");

    if (count) {
        count.textContent = `(${players.length}/8)`;
    }


    if (!container) return;


    container.innerHTML = "";


    players.forEach((player, index) => {

        const div = document.createElement("div");

        div.className = "player";

        div.innerHTML = `
            <div class="player-avatar">
                ${getAvatar(index)}
            </div>

            <span>
                ${escapeHtml(player.name)}
            </span>

            ${player.is_host
                ? `<small>HOST</small>`
                : ""}
        `;

        container.appendChild(div);
    });


    const startButton = $("start");

    if (startButton) {

        startButton.style.display =
            isHost ? "block" : "none";
    }
}


function getAvatar(index) {

    const avatars = [
        "😎",
        "🤠",
        "😈",
        "🤓",
        "🥶",
        "🤩",
        "😏",
        "👽"
    ];

    return avatars[index % avatars.length];
}


function escapeHtml(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


// ============================================================
// START GAME
// ============================================================

async function startGame() {

    if (!isHost) return;


    const {
        data: players,
        error
    } = await db
        .from("players")
        .select("*")
        .eq("room_code", roomCode)
        .order("joined_at", {
            ascending: true
        });


    if (error) {

        console.error(error);

        toast("Could not start game");

        return;
    }


    if (players.length < 2) {

        toast("Need at least 2 players");

        return;
    }


    const deck = createDeck();


    const hands = {};

    const uno = {};


    // Deal 7 cards each

    players.forEach(player => {

        hands[player.id] = deck.splice(0, 7);

        uno[player.id] = false;
    });


    let discardCard = deck.pop();


    // Don't start with action/wild
    while (
        discardCard.value === "wild" ||
        discardCard.value === "+4" ||
        discardCard.value === "+10" ||
        discardCard.value === "+2" ||
        discardCard.value === "skip" ||
        discardCard.value === "reverse"
    ) {

        deck.unshift(discardCard);

        discardCard = deck.pop();
    }


    const gameState = {

        deck,

        discard: [discardCard],

        currentColor: discardCard.color,

        currentPlayerIndex: 0,

        direction: 1,

        pendingDraw: 0,

        pendingStackType: null,

        uno,

        hands,

        winner: null,

        started: true
    };


    const { error: stateError } = await db
        .from("rooms")
        .update({
            game_started: true,
            game_state: gameState
        })
        .eq("code", roomCode);


    if (stateError) {

        console.error("START ERROR:", stateError);

        toast("Could not start game");

        return;
    }


    // Also save individual hands
    for (const player of players) {

        await db
            .from("player_hands")
            .upsert({
                player_id: player.id,
                room_code: roomCode,
                hand: hands[player.id]
            }, {
                onConflict: "player_id"
            });
    }


    state = gameState;

    buildGameInterface();

    showScreen("game");

    renderGame();

    startPolling();
}


// ============================================================
// POLLING / SYNC
// ============================================================

function startPolling() {

    if (pollTimer) {
        clearInterval(pollTimer);
    }


    // IMPORTANT:
    // Keep polling even after game starts.

    syncEverything();

    pollTimer = setInterval(() => {

        syncEverything();

    }, 650);
}


async function syncEverything() {

    if (!roomCode) return;


    try {

        const {
            data: room,
            error: roomError
        } = await db
            .from("rooms")
            .select("*")
            .eq("code", roomCode)
            .maybeSingle();


        if (roomError) {
            console.error(roomError);
            return;
        }


        if (!room) return;


        if (!room.game_started) {

            if (
                document.querySelector("#lobby.active")
            ) {
                await updateLobby();
            }

            return;
        }


        // Game has started

        if (room.game_state) {

            const oldState = state;

            state = room.game_state;


            if (
                !document.querySelector("#game.active")
            ) {

                buildGameInterface();

                showScreen("game");
            }


            renderGame();


            // Winner
            if (
                state.winner &&
                state.winner !== oldState?.winner
            ) {

                showWinner();
            }
        }

    } catch (err) {

        console.error("SYNC ERROR:", err);
    }
}


// ============================================================
// BUILD GAME UI
// ============================================================

function buildGameInterface() {

    const game = $("game");

    if (!game) return;


    game.innerHTML = `

        <header>

            <strong class="small-logo">
                UNO
            </strong>

            <div id="turn">
                Waiting...
            </div>

            <div id="color">
                Color: -
            </div>

        </header>


        <div id="opponents"></div>


        <main class="table">

            <button
                id="drawPile"
                class="card back"
            >
                UNO
            </button>

            <div id="topCard" class="card">
                ?
            </div>

        </main>


        <div class="my-area">

            <div id="hand" class="hand"></div>

            <div class="actions">

                <button id="draw">
                    DRAW CARD
                </button>

                <button
                    id="uno"
                    class="uno-button"
                >
                    UNO!
                </button>

            </div>

        </div>

        <div
            id="modal"
            class="modal hidden"
        >

            <div class="modal-box">

                <h2>Choose a color</h2>

                <button data-color="red">
                    RED
                </button>

                <button data-color="yellow">
                    YELLOW
                </button>

                <button data-color="green">
                    GREEN
                </button>

                <button data-color="blue">
                    BLUE
                </button>

            </div>

        </div>
    `;


    $("draw")?.addEventListener(
        "click",
        drawCard
    );


    $("uno")?.addEventListener(
        "click",
        callUno
    );


    $("drawPile")?.addEventListener(
        "click",
        drawCard
    );


    document
        .querySelectorAll("[data-color]")
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


// ============================================================
// RENDER GAME
// ============================================================

async function renderGame() {

    if (!state) return;


    renderTopCard();

    renderTurn();

    renderOpponents();

    renderHand();

    renderColor();
}


// ============================================================
// TOP CARD
// ============================================================

function renderTopCard() {

    const el = $("topCard");

    if (!el) return;


    const card =
        state.discard[state.discard.length - 1];


    if (!card) return;


    el.className =
        `card ${card.color} ${card.value.replace("+", "plus")}`;


    el.innerHTML =
        cardDisplay(card);
}


// ============================================================
// TURN
// ============================================================

function getCurrentPlayer() {

    const players = getPlayersFromState();

    if (!players.length) return null;

    return players[state.currentPlayerIndex];
}


function getPlayersFromState() {

    // Players are stored separately,
    // so renderOpponents fetches them.
    // This function uses the last known list.

    return window.unoPlayers || [];
}


async function refreshPlayers() {

    const {
        data: players
    } = await db
        .from("players")
        .select("*")
        .eq("room_code", roomCode)
        .order("joined_at", {
            ascending: true
        });


    window.unoPlayers = players || [];

    return window.unoPlayers;
}


async function renderTurn() {

    const players =
        await refreshPlayers();


    const current =
        players[state.currentPlayerIndex];


    const turnEl = $("turn");

    if (!turnEl || !current) return;


    if (current.id === playerId) {

        turnEl.textContent = "YOUR TURN";

        turnEl.classList.add("my-turn");

    } else {

        turnEl.textContent =
            `${current.name}'s turn`;

        turnEl.classList.remove("my-turn");
    }
}


// ============================================================
// OPPONENTS
// ============================================================

async function renderOpponents() {

    const container = $("opponents");

    if (!container) return;


    const players =
        await refreshPlayers();


    container.innerHTML = "";


    players
        .filter(player => player.id !== playerId)
        .forEach((player, index) => {

            const hand =
                state.hands[player.id] || [];


            const div =
                document.createElement("div");


            div.className = "opponent";


            let cards = "";


            for (
                let i = 0;
                i < Math.min(hand.length, 8);
                i++
            ) {

                cards += `
                    <div class="mini-card-back">
                        UNO
                    </div>
                `;
            }


            div.innerHTML = `

                <div class="opponent-name">

                    <span class="avatar">
                        ${getAvatar(index)}
                    </span>

                    ${escapeHtml(player.name)}

                </div>

                <div class="opponent-cards">
                    ${cards}
                </div>

                <div class="card-count">
                    ${hand.length} cards
                </div>
            `;


            container.appendChild(div);
        });
}


// ============================================================
// MY HAND
// ============================================================

function renderHand() {

    const container = $("hand");

    if (!container) return;


    const hand =
        state.hands[playerId] || [];


    container.innerHTML = "";


    hand.forEach((card, index) => {

        const button =
            document.createElement("button");


        button.className =
            `card hand-card ${card.color}`;


        if (canPlay(card)) {

            button.classList.add("playable");
        }


        button.innerHTML =
            cardDisplay(card);


        button.addEventListener(
            "click",
            () => playCard(index)
        );


        container.appendChild(button);
    });
}


// ============================================================
// CARD DISPLAY
// ============================================================

function cardDisplay(card) {

    if (card.value === "skip") {
        return "⊘";
    }

    if (card.value === "reverse") {
        return "↻";
    }

    if (card.value === "+2") {
        return "+2";
    }

    if (card.value === "+4") {
        return "+4";
    }

    if (card.value === "+10") {
        return "+10";
    }

    if (card.value === "wild") {
        return "WILD";
    }

    return card.value;
}


// ============================================================
// COLOR
// ============================================================

function renderColor() {

    const el = $("color");

    if (!el) return;


    el.textContent =
        `Color: ${state.currentColor.toUpperCase()}`;
}


// ============================================================
// PLAYABILITY
// ============================================================

function canPlay(card) {

    if (!state) return false;


    const players =
        getPlayersFromState();


    const current =
        players[state.currentPlayerIndex];


    if (!current) return false;


    if (current.id !== playerId) {
        return false;
    }


    // If there is a stacking penalty
    if (state.pendingStackType) {

        return card.value ===
            state.pendingStackType;
    }


    // +4 can ALWAYS be played
    if (card.value === "+4") {
        return true;
    }


    // +10 is also wild
    if (card.value === "+10") {
        return true;
    }


    // Wild
    if (card.value === "wild") {
        return true;
    }


    const top =
        state.discard[state.discard.length - 1];


    if (!top) return true;


    // Color match
    if (card.color === state.currentColor) {
        return true;
    }


    // Value match
    if (card.value === top.value) {
        return true;
    }


    return false;
}


// ============================================================
// PLAY CARD
// ============================================================

async function playCard(index) {

    if (!state) return;


    const players =
        getPlayersFromState();


    const current =
        players[state.currentPlayerIndex];


    if (!current || current.id !== playerId) {

        toast("Not your turn");

        return;
    }


    const hand =
        state.hands[playerId] || [];


    const card = hand[index];


    if (!card) return;


    if (!canPlay(card)) {

        toast("You can't play that card");

        return;
    }


    // Remove card
    hand.splice(index, 1);


    // UNO state
    if (hand.length === 1) {

        state.uno[playerId] = false;
    }


    state.discard.push(card);


    // --------------------------------------------------------
    // STACK +2
    // --------------------------------------------------------

    if (card.value === "+2") {

        if (
            state.pendingStackType === "+2"
        ) {

            state.pendingDraw += 2;

        } else {

            state.pendingDraw = 2;
        }


        state.pendingStackType = "+2";


        advanceTurn();

        await saveState();

        return;
    }


    // --------------------------------------------------------
    // STACK +4
    // --------------------------------------------------------

    if (card.value === "+4") {

        if (
            state.pendingStackType === "+4"
        ) {

            state.pendingDraw += 4;

        } else {

            state.pendingDraw = 4;
        }


        state.pendingStackType = "+4";

        pendingWild = true;


        await saveState();

        openColorPicker();

        return;
    }


    // --------------------------------------------------------
    // STACK +10
    // --------------------------------------------------------

    if (card.value === "+10") {

        if (
            state.pendingStackType === "+10"
        ) {

            state.pendingDraw += 10;

        } else {

            state.pendingDraw = 10;
        }


        state.pendingStackType = "+10";

        pendingWild = true;


        await saveState();

        openColorPicker();

        return;
    }


    // --------------------------------------------------------
    // NORMAL WILD
    // --------------------------------------------------------

    if (card.value === "wild") {

        pendingWild = true;

        await saveState();

        openColorPicker();

        return;
    }


    // --------------------------------------------------------
    // ACTION CARDS
    // --------------------------------------------------------

    if (card.value === "skip") {

        advanceTurn();

        advanceTurn();

    }

    else if (card.value === "reverse") {

        state.direction *= -1;

        advanceTurn();

    }

    else {

        advanceTurn();
    }


    await saveState();
}


// ============================================================
// COLOR PICKER
// ============================================================

function openColorPicker() {

    const modal = $("modal");

    if (!modal) return;


    modal.classList.remove("hidden");
}


async function chooseColor(color) {

    if (!pendingWild) return;


    state.currentColor = color;

    pendingWild = false;


    const modal = $("modal");

    if (modal) {
        modal.classList.add("hidden");
    }


    advanceTurn();


    await saveState();
}


// ============================================================
// ADVANCE TURN
// ============================================================

function advanceTurn() {

    const players =
        getPlayersFromState();


    if (!players.length) return;


    state.currentPlayerIndex +=
        state.direction;


    if (
        state.currentPlayerIndex >=
        players.length
    ) {

        state.currentPlayerIndex = 0;
    }


    if (state.currentPlayerIndex < 0) {

        state.currentPlayerIndex =
            players.length - 1;
    }


    turnDrawn = false;
}


// ============================================================
// DRAW CARD
// ============================================================

async function drawCard() {

    if (!state) return;


    const players =
        getPlayersFromState();


    const current =
        players[state.currentPlayerIndex];


    if (!current || current.id !== playerId) {

        toast("Not your turn");

        return;
    }


    const hand =
        state.hands[playerId] || [];


    let amount = 1;


    // Penalty
    if (state.pendingDraw > 0) {

        amount = state.pendingDraw;

        toast(`Drawing +${amount} cards`);

        state.pendingDraw = 0;

        state.pendingStackType = null;

        turnDrawn = false;

    } else {

        // Only one normal draw per turn
        if (turnDrawn) {

            toast("You already drew");

            return;
        }

        turnDrawn = true;
    }


    const drawnCards = [];


    for (let i = 0; i < amount; i++) {

        if (state.deck.length === 0) {

            reshuffleDeck();
        }


        if (state.deck.length === 0) break;


        const card =
            state.deck.pop();


        hand.push(card);

        drawnCards.push(card);
    }


    renderHand();


    animateDrawCards(
        drawnCards.length
    );


    // Penalty immediately ends turn
    if (amount > 1) {

        advanceTurn();
    }


    await saveState();
}


// ============================================================
// RESHUFFLE
// ============================================================

function reshuffleDeck() {

    if (state.discard.length <= 1) {
        return;
    }


    const top =
        state.discard.pop();


    state.deck =
        shuffle(state.discard);


    state.discard = [top];
}


// ============================================================
// UNO
// ============================================================

async function callUno() {

    if (!state) return;


    const hand =
        state.hands[playerId] || [];


    if (hand.length === 1) {

        state.uno[playerId] = true;

        toast("UNO! 🔥");

        await saveState();

        return;
    }


    // Wrong UNO penalty +10
    for (let i = 0; i < 10; i++) {

        if (state.deck.length === 0) {
            reshuffleDeck();
        }

        if (state.deck.length === 0) break;

        hand.push(state.deck.pop());
    }


    toast("Wrong UNO! +10 cards 😭");


    await saveState();
}


// ============================================================
// SAVE STATE
// ============================================================

async function saveState() {

    if (!roomCode || !state) return;


    const { error } = await db
        .from("rooms")
        .update({
            game_state: state
        })
        .eq("code", roomCode);


    if (error) {

        console.error(
            "SAVE STATE ERROR:",
            error
        );
    }


    // Save own hand separately too
    await db
        .from("player_hands")
        .upsert({
            player_id: playerId,
            room_code: roomCode,
            hand: state.hands[playerId] || []
        }, {
            onConflict: "player_id"
        });
}


// ============================================================
// WINNER
// ============================================================

function checkWinner() {

    for (const id in state.hands) {

        if (state.hands[id].length === 0) {

            state.winner = id;

            return true;
        }
    }


    return false;
}


async function showWinner() {

    const players =
        await refreshPlayers();


    const winner =
        players.find(
            p => p.id === state.winner
        );


    if (!winner) return;


    const overlay =
        document.createElement("div");


    overlay.className =
        "winner-overlay";


    overlay.innerHTML = `

        <div class="winner-box">

            <div class="winner-title">
                🎉 UNO!
            </div>

            <h1>
                ${escapeHtml(winner.name)}
                WINS!
            </h1>

            <button onclick="location.reload()">
                PLAY AGAIN
            </button>

        </div>
    `;


    document.body.appendChild(overlay);
}


// ============================================================
// DRAW ANIMATION
// ============================================================

function animateDrawCards(count) {

    if (!count) return;


    const drawPile =
        $("drawPile");


    const hand =
        $("hand");


    if (!drawPile || !hand) return;


    const source =
        drawPile.getBoundingClientRect();


    for (let i = 0; i < Math.min(count, 5); i++) {

        const flying =
            document.createElement("div");


        flying.className =
            "flying-card";


        flying.textContent =
            "UNO";


        document.body.appendChild(flying);


        const target =
            hand.getBoundingClientRect();


        flying.style.left =
            `${source.left}px`;

        flying.style.top =
            `${source.top}px`;


        requestAnimationFrame(() => {

            flying.style.left =
                `${target.left + target.width / 2}px`;

            flying.style.top =
                `${target.top}px`;

            flying.style.transform =
                "rotate(20deg) scale(.6)";

            flying.style.opacity =
                "0";
        });


        setTimeout(() => {

            flying.remove();

        }, 650 + i * 80);
    }
}


// ============================================================
// LEAVE ROOM
// ============================================================

async function leaveGame() {

    if (!roomCode) {
        location.reload();
        return;
    }


    if (pollTimer) {

        clearInterval(pollTimer);

        pollTimer = null;
    }


    await db
        .from("player_hands")
        .delete()
        .eq("player_id", playerId);


    await db
        .from("players")
        .delete()
        .eq("id", playerId);


    location.reload();
}


// ============================================================
// COPY ROOM CODE
// ============================================================

async function copyRoomCode() {

    if (!roomCode) return;


    try {

        await navigator.clipboard.writeText(
            roomCode
        );

        toast("Room code copied!");

    } catch {

        toast("Copy failed");
    }
}


// ============================================================
// EVENT LISTENERS
// ============================================================

function setupHomeButtons() {

    const create =
        $("create");

    const join =
        $("join");

    const copy =
        $("copy");

    const start =
        $("start");

    const leave =
        $("leave");


    if (create) {

        create.addEventListener(
            "click",
            createRoom
        );
    }


    if (join) {

        join.addEventListener(
            "click",
            joinRoom
        );
    }


    if (copy) {

        copy.addEventListener(
            "click",
            copyRoomCode
        );
    }


    if (start) {

        start.addEventListener(
            "click",
            startGame
        );
    }


    if (leave) {

        leave.addEventListener(
            "click",
            leaveGame
        );
    }


    // Enter key support
    $("name")?.addEventListener(
        "keydown",
        e => {

            if (e.key === "Enter") {
                createRoom();
            }
        }
    );


    $("code")?.addEventListener(
        "keydown",
        e => {

            if (e.key === "Enter") {
                joinRoom();
            }
        }
    );
}


// ============================================================
// MOBILE ROTATION
// ============================================================

function setupRotationOverlay() {

    if (!document.querySelector(".rotate-overlay")) {

        const overlay =
            document.createElement("div");


        overlay.className =
            "rotate-overlay";


        overlay.innerHTML = `

            <div>

                <div class="rotate-icon">
                    📱
                </div>

                <h2>
                    Rotate Your Phone
                </h2>

                <p>
                    Please use landscape mode
                    to play UNO.
                </p>

            </div>
        `;


        document.body.appendChild(overlay);
    }
}


// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "UNO Friends — 8 player multiplayer loaded"
        );


        setupHomeButtons();

        setupRotationOverlay();
    }
);


// ============================================================
// MAKE FUNCTIONS AVAILABLE
// ============================================================

window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.startGame = startGame;
window.leaveGame = leaveGame;
window.copyRoomCode = copyRoomCode;
window.drawCard = drawCard;
window.callUno = callUno;
window.chooseColor = chooseColor;
