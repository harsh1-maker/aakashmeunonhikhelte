/* =========================================================
   UNO FRIENDS - COMPLETE GAME.JS
   Supabase multiplayer version
   ========================================================= */

/* =========================
   SUPABASE
   ========================= */

const SUPABASE_URL = "https://cumwoqdzpsidocqvulxd.supabase.co";

/*
   IMPORTANT:
   Keep your existing Supabase publishable/anon key here.
*/
const SUPABASE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


/* =========================
   GLOBAL GAME VARIABLES
   ========================= */

let playerId = crypto.randomUUID();

let playerName = "";
let roomCode = "";

let isHost = false;

let players = [];

let gameState = null;

let polling = null;

let waitingForColor = false;
let pendingColorCard = null;


/* =========================
   DOM
   ========================= */

const homeScreen = document.getElementById("home");
const lobbyScreen = document.getElementById("lobby");
const gameScreen = document.getElementById("game");

const nameInput = document.getElementById("name");
const codeInput = document.getElementById("code");

const createBtn = document.getElementById("create");
const joinBtn = document.getElementById("join");

const roomCodeElement = document.getElementById("roomCode");
const copyBtn = document.getElementById("copy");

const playersElement = document.getElementById("players");
const countElement = document.getElementById("count");

const startBtn = document.getElementById("start");
const leaveBtn = document.getElementById("leave");

const opponentsElement = document.getElementById("opponents");

const drawPileElement = document.getElementById("drawPile");
const topCardElement = document.getElementById("topCard");

const handElement = document.getElementById("hand");

const drawBtn = document.getElementById("draw");
const unoBtn = document.getElementById("uno");

const turnElement = document.getElementById("turn");
const colorElement = document.getElementById("color");

const modal = document.getElementById("modal");
const toast = document.getElementById("toast");


/* =========================
   UTILITIES
   ========================= */

function showScreen(screen) {

    document.querySelectorAll(".screen").forEach(s => {
        s.classList.remove("active");
    });

    screen.classList.add("active");
}


function showToast(message) {

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
        toast.classList.remove("show");
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


function shuffle(array) {

    const arr = [...array];

    for (let i = arr.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr;
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


/* =========================
   CARD CREATION
   ========================= */

function createCard(color, value) {

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

        /* One zero */

        deck.push(createCard(color, "0"));

        /* Two of each 1-9 */

        for (let n = 1; n <= 9; n++) {

            deck.push(createCard(color, String(n)));
            deck.push(createCard(color, String(n)));
        }

        /* Action cards */

        for (let i = 0; i < 2; i++) {

            deck.push(createCard(color, "skip"));
            deck.push(createCard(color, "reverse"));
            deck.push(createCard(color, "+2"));
        }
    });


    /* Wild */

    for (let i = 0; i < 4; i++) {
        deck.push(createCard("wild", "wild"));
    }


    /* Wild +4 */

    for (let i = 0; i < 4; i++) {
        deck.push(createCard("wild", "+4"));
    }


    /* Custom +10 */

    for (let i = 0; i < 4; i++) {
        deck.push(createCard("wild", "+10"));
    }


    /* Custom +20 */

    for (let i = 0; i < 4; i++) {
        deck.push(createCard("wild", "+20"));
    }


    return shuffle(deck);
}


/* =========================
   CARD HELPERS
   ========================= */

function cardText(card) {

    if (!card) return "?";

    switch (card.value) {

        case "skip":
            return "⊘";

        case "reverse":
            return "↻";

        case "+2":
            return "+2";

        case "+4":
            return "+4";

        case "+10":
            return "+10";

        case "+20":
            return "+20";

        case "wild":
            return "WILD";

        default:
            return card.value;
    }
}


function isWild(card) {

    return (
        card &&
        (
            card.value === "wild" ||
            card.value === "+4" ||
            card.value === "+10" ||
            card.value === "+20"
        )
    );
}


function drawAmount(card) {

    if (!card) return 0;

    if (card.value === "+2") return 2;
    if (card.value === "+4") return 4;
    if (card.value === "+10") return 10;
    if (card.value === "+20") return 20;

    return 0;
}


/* =========================
   GAME STATE
   ========================= */

function createInitialGameState(roomPlayers) {

    let deck = createDeck();

    const hands = {};

    roomPlayers.forEach(player => {

        hands[player.id] = [];

        for (let i = 0; i < 7; i++) {

            hands[player.id].push(deck.pop());
        }
    });


    /*
       Find a normal starting card.
    */

    let firstCardIndex = deck.findIndex(card => !isWild(card));

    if (firstCardIndex === -1) {
        firstCardIndex = 0;
    }

    const firstCard = deck.splice(firstCardIndex, 1)[0];

    return {

        deck,

        discard: [firstCard],

        hands,

        currentPlayerIndex: 0,

        direction: 1,

        currentColor: firstCard.color,

        pendingDraw: 0,

        winner: null,

        started: true,

        lastAction: "Game started",

        unoCalls: {},

        createdAt: Date.now()
    };
}


/* =========================
   DATABASE
   ========================= */

async function getRoom() {

    const { data, error } = await supabaseClient
        .from("rooms")
        .select("*")
        .eq("code", roomCode)
        .single();

    if (error) {

        console.error(error);

        return null;
    }

    return data;
}


async function getPlayers() {

    const { data, error } = await supabaseClient
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


async function saveGameState(state) {

    const { error } = await supabaseClient
        .from("rooms")
        .update({
            game_state: state
        })
        .eq("code", roomCode);

    if (error) {

        console.error("Save game error:", error);

        showToast("Could not save game");
        return false;
    }

    return true;
}


async function loadGameState() {

    const room = await getRoom();

    if (!room) return null;

    return room.game_state || null;
}


/* =========================
   CREATE ROOM
   ========================= */

createBtn.addEventListener("click", async () => {

    playerName = nameInput.value.trim();

    if (!playerName) {

        showToast("Enter your name first");
        nameInput.focus();

        return;
    }


    createBtn.disabled = true;

    createBtn.textContent = "CREATING...";


    try {

        let newCode = generateRoomCode();

        /*
           Make sure code isn't already used.
        */

        let existing = await getRoomByCode(newCode);

        while (existing) {

            newCode = generateRoomCode();

            existing = await getRoomByCode(newCode);
        }


        const { error: roomError } = await supabaseClient
            .from("rooms")
            .insert({
                code: newCode,
                game_started: false,
                game_state: null
            });


        if (roomError) {

            console.error(roomError);

            showToast("Could not create room");

            return;
        }


        const { error: playerError } = await supabaseClient
            .from("players")
            .insert({
                id: playerId,
                room_code: newCode,
                name: playerName,
                is_host: true
            });


        if (playerError) {

            console.error(playerError);

            await supabaseClient
                .from("rooms")
                .delete()
                .eq("code", newCode);

            showToast("Could not join room");

            return;
        }


        roomCode = newCode;
        isHost = true;

        await enterLobby();

    } finally {

        createBtn.disabled = false;
        createBtn.textContent = "CREATE ROOM";
    }
});


async function getRoomByCode(code) {

    const { data } = await supabaseClient
        .from("rooms")
        .select("code")
        .eq("code", code)
        .maybeSingle();

    return data;
}


/* =========================
   JOIN ROOM
   ========================= */

joinBtn.addEventListener("click", async () => {

    playerName = nameInput.value.trim();

    roomCode = codeInput.value.trim().toUpperCase();


    if (!playerName) {

        showToast("Enter your name first");
        return;
    }


    if (!roomCode || roomCode.length !== 6) {

        showToast("Enter a valid 6-character room code");
        return;
    }


    joinBtn.disabled = true;
    joinBtn.textContent = "JOINING...";


    try {

        const room = await getRoom();


        if (!room) {

            showToast("Room not found");
            return;
        }


        if (room.game_started) {

            showToast("Game already started");
            return;
        }


        const currentPlayers = await getPlayers();


        if (currentPlayers.length >= 6) {

            showToast("Room is full");
            return;
        }


        const duplicateName = currentPlayers.some(
            p => p.name.toLowerCase() === playerName.toLowerCase()
        );


        if (duplicateName) {

            showToast("That name is already taken");
            return;
        }


        const { error } = await supabaseClient
            .from("players")
            .insert({
                id: playerId,
                room_code: roomCode,
                name: playerName,
                is_host: false
            });


        if (error) {

            console.error(error);

            showToast("Could not join room");
            return;
        }


        isHost = false;

        await enterLobby();

    } finally {

        joinBtn.disabled = false;
        joinBtn.textContent = "JOIN ROOM";
    }
});


/* =========================
   ENTER LOBBY
   ========================= */

async function enterLobby() {

    showScreen(lobbyScreen);

    roomCodeElement.textContent = roomCode;

    await refreshLobby();

    startPolling();
}


/* =========================
   LOBBY POLLING
   ========================= */

function startPolling() {

    stopPolling();

    polling = setInterval(async () => {

        await syncRoom();

    }, 900);
}


function stopPolling() {

    if (polling) {

        clearInterval(polling);
        polling = null;
    }
}


/* =========================
   SYNC ROOM
   ========================= */

async function syncRoom() {

    if (!roomCode) return;


    const room = await getRoom();

    if (!room) {

        showToast("Room no longer exists");

        leaveRoom(false);

        return;
    }


    players = await getPlayers();


    /*
       Check if game started.
    */

    if (room.game_started) {

        gameState = room.game_state;

        if (gameState) {

            stopPolling();

            showScreen(gameScreen);

            renderGame();
        }

        return;
    }


    /*
       Still lobby.
    */

    if (
        document
            .getElementById("lobby")
            .classList
            .contains("active")
    ) {

        renderLobby();
    }
}


/* =========================
   LOBBY RENDER
   ========================= */

async function refreshLobby() {

    players = await getPlayers();

    renderLobby();
}


function renderLobby() {

    countElement.textContent = `(${players.length}/6)`;

    playersElement.innerHTML = "";


    players.forEach((player, index) => {

        const row = document.createElement("div");

        row.className = "player-row";


        const avatar = document.createElement("div");

        avatar.className = "player-avatar";

        avatar.textContent = getAvatar(player.name);


        const info = document.createElement("div");

        info.className = "player-info";


        const name = document.createElement("div");

        name.className = "player-name";

        name.textContent = player.name;


        const status = document.createElement("div");

        status.className = "player-status";

        status.textContent = player.is_host
            ? "HOST"
            : "PLAYER";


        info.appendChild(name);
        info.appendChild(status);


        row.appendChild(avatar);
        row.appendChild(info);


        if (player.id === playerId) {

            const you = document.createElement("span");

            you.className = "you-tag";

            you.textContent = "YOU";

            row.appendChild(you);
        }


        playersElement.appendChild(row);
    });


    startBtn.style.display = isHost ? "block" : "none";


    if (!isHost) {

        startBtn.disabled = true;
    }
}


/* =========================
   AVATAR
   ========================= */

function getAvatar(name) {

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
        "👽",
        "🤖"
    ];


    let total = 0;

    for (let i = 0; i < name.length; i++) {

        total += name.charCodeAt(i);
    }


    return avatars[total % avatars.length];
}


/* =========================
   START GAME
   ========================= */

startBtn.addEventListener("click", async () => {

    if (!isHost) return;


    players = await getPlayers();


    if (players.length < 2) {

        showToast("Need at least 2 players");
        return;
    }


    if (players.length > 6) {

        showToast("Maximum 6 players");
        return;
    }


    startBtn.disabled = true;
    startBtn.textContent = "STARTING...";


    try {

        const state = createInitialGameState(players);


        const { error } = await supabaseClient
            .from("rooms")
            .update({
                game_started: true,
                game_state: state
            })
            .eq("code", roomCode);


        if (error) {

            console.error(error);

            showToast("Could not start game");

            startBtn.disabled = false;
            startBtn.textContent = "START GAME";

            return;
        }


        gameState = state;

        stopPolling();

        showScreen(gameScreen);

        renderGame();


    } catch (error) {

        console.error(error);

        showToast("Game could not start");

        startBtn.disabled = false;
        startBtn.textContent = "START GAME";
    }
});


/* =========================
   COPY ROOM CODE
   ========================= */

copyBtn.addEventListener("click", async () => {

    try {

        await navigator.clipboard.writeText(roomCode);

        copyBtn.textContent = "COPIED!";

        showToast("Room code copied");

        setTimeout(() => {

            copyBtn.textContent = "COPY ROOM CODE";

        }, 1500);

    } catch {

        showToast(`Room code: ${roomCode}`);
    }
});


/* =========================
   LEAVE ROOM
   ========================= */

leaveBtn.addEventListener("click", async () => {

    await leaveRoom(true);
});


async function leaveRoom(showMessage = true) {

    stopPolling();


    if (roomCode) {

        await supabaseClient
            .from("players")
            .delete()
            .eq("id", playerId)
            .eq("room_code", roomCode);
    }


    roomCode = "";
    playerName = "";
    isHost = false;
    players = [];
    gameState = null;


    showScreen(homeScreen);


    if (showMessage) {

        showToast("You left the room");
    }
}


/* =========================
   GAME RENDER
   ========================= */

function renderGame() {

    if (!gameState) return;


    renderTopCard();

    renderTurn();

    renderColor();

    renderOpponents();

    renderHand();

    renderActions();
}


/* =========================
   TOP CARD
   ========================= */

function renderTopCard() {

    const card = gameState.discard[
        gameState.discard.length - 1
    ];


    topCardElement.innerHTML = "";

    topCardElement.className = "card top-card";


    if (!card) {

        topCardElement.textContent = "?";
        return;
    }


    topCardElement.classList.add(
        card.color === "wild"
            ? "wild-card"
            : `${card.color}-card`
    );


    const oval = document.createElement("div");

    oval.className = "card-oval";


    const value = document.createElement("span");

    value.className = "card-value";

    value.textContent = cardText(card);


    oval.appendChild(value);

    topCardElement.appendChild(oval);
}


/* =========================
   TURN
   ========================= */

function renderTurn() {

    if (!players.length) return;


    const currentPlayer =
        players[gameState.currentPlayerIndex];


    if (!currentPlayer) return;


    const myTurn =
        currentPlayer.id === playerId;


    if (myTurn) {

        turnElement.textContent = "YOUR TURN";

        turnElement.className = "your-turn";

    } else {

        turnElement.textContent =
            `${currentPlayer.name}'S TURN`;

        turnElement.className = "";
    }
}


/* =========================
   CURRENT COLOR
   ========================= */

function renderColor() {

    const color = gameState.currentColor || "-";

    colorElement.textContent =
        `Color: ${color.toUpperCase()}`;

    colorElement.dataset.color = color;
}


/* =========================
   OPPONENTS
   ========================= */

function renderOpponents() {

    opponentsElement.innerHTML = "";


    const opponents = players.filter(
        player => player.id !== playerId
    );


    opponents.forEach((player, index) => {

        const wrapper = document.createElement("div");

        wrapper.className = "opponent";


        if (
            players[gameState.currentPlayerIndex] &&
            players[gameState.currentPlayerIndex].id === player.id
        ) {

            wrapper.classList.add("active-opponent");
        }


        const avatar = document.createElement("div");

        avatar.className = "opponent-avatar";

        avatar.textContent = getAvatar(player.name);


        const name = document.createElement("div");

        name.className = "opponent-name";

        name.textContent = player.name;


        const hand =
            gameState.hands[player.id] || [];


        const cardCount = document.createElement("div");

        cardCount.className = "opponent-card-count";

        cardCount.textContent = hand.length
