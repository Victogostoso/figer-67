/**
 * Finger 67: Tactical Duel
 * Lógica de Jogo e Interface (HUD)
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const gameOverScreen = document.getElementById('game-over');
const winnerText = document.getElementById('winner-text');
const messageCenter = document.getElementById('message-center');
const controlsHint = document.getElementById('controls-hint');

// Configurações do Canvas
const GAME_WIDTH = 960;
const GAME_HEIGHT = 600;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// Constantes de Jogo
const PLAYER_SIZE = 40;
const BULLET_RADIUS = 5;
const PLAYER_SPEED = 4;
const BULLET_SPEED = 8;
const INITIAL_LIVES = 5;
const MAX_AMMO = 5;
const DASH_DISTANCE = 100;
const DASH_COOLDOWN = 1000; // 1 segundo
const SHOOT_COOLDOWN = 400; // Novo: 0.4s entre tiros para evitar bagunça

// Estado do Jogo
let gameActive = false;
let gameSpeed = 1.0; // Novo: Multiplicador de velocidade (Slow Mo)
let player1, player2;
let bullets = [];
let ammoBoxes = [];
let obstacles = [];
let obstacleTimer; // Controle de respawn
let particles = [];
let debris = []; // Novo: Destroços maiores pós-morte
let screenShake = 0;
let keys = {};
let isSoloMode = false; // Começa como DUAL
let bgImage = new Image();
bgImage.src = 'fundo_messier.png';
let bgX = 0;
let shieldBox = null; // Novo: Coletável de escudo
let camera = { x: 0, y: 0, scale: 1, active: false, targetBullet: null }; // Novo: targetBullet para rastreio
let botLastDecision = 0; // Para IA decidir novos pontos
let botAITarget = { x: 0, y: 0 };
let currentArena = 'classic'; // Novo: tipo de arena ativa
let lastHitTime = { p1: 0, p2: 0 }; // Novo: para tremor do HUD
let uiEffects = []; // Novo: para textos flutuantes (feedback de dano)
let dashGhosts = []; // Novo: para o efeito de "eco" no dash
let botDifficulty = 'medium'; // Novo: easy, medium, hard
let introTimer = 0; // Novo: para contagem regressiva 3, 2, 1
let slowMoTimeout = null; // Novo: para controlar o limite de 1.5s
let shockwaves = []; // Novo: anéis visuais de explosão
// Camadas de estrelas para o Parallax (profundidade)
let starLayers = [
    { stars: [], speed: 0.1, size: 0.8, alpha: 0.2 }, // Longe (lenta)
    { stars: [], speed: 0.25, size: 1.2, alpha: 0.4 }, // Média
    { stars: [], speed: 0.6, size: 2.0, alpha: 0.7 }   // Perto (rápida)
];

// Cores Neon
const COLORS = {
    p1: '#00f7ff', // Ciano
    p2: '#ff00ff', // Rosa
    bullet: '#ffffff',
    ammo: '#00ff00',
    bg: '#0a0a0c'
};

/**
 * Cria partículas neon
 */
function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1.0,
            color: color
        });
    }
}

/**
 * Inicializa as estrelas do Parallax
 */
function initStars() {
    starLayers.forEach(layer => {
        layer.stars = [];
        const count = 50; // 50 estrelas por camada
        for (let i = 0; i < count; i++) {
            layer.stars.push({
                x: Math.random() * GAME_WIDTH,
                y: Math.random() * GAME_HEIGHT
            });
        }
    });
}

/**
 * Cria ecos (fantasmas) para o rastro do dash
 */
function createDashGhosts(p) {
    for (let i = 1; i <= 3; i++) {
        dashGhosts.push({
            x: p.x,
            y: p.y,
            angle: p.angle,
            color: p.color,
            handState: p.handState,
            life: 0.8 - (i * 0.2), // Cada fantasma nasce mais fraco
            delay: i * 50 // Tempo para começar a sumir
        });
    }
}

/**
 * Cria destroços maiores para explosão final
 */
function createDebris(x, y, color) {
    for (let i = 0; i < 60; i++) { // Aumentado para 60 para mais impacto
        debris.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            size: Math.random() * 8 + 4,
            angle: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.2,
            life: 1.5,
            color: color
        });
    }
}

// --- SISTEMA DE ÁUDIO PROCEDURAL ---
const AudioEngine = {
    ctx: null,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    playShoot() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    },

    playError() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.setValueAtTime(100, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    },

    playHit() {
        if (!this.ctx) return;
        const noise = this.ctx.createBufferSource();
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
        noise.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    },

    // Música Synthwave Imersiva
    bgm: {
        playing: false,
        step: 0,
        bassNotes: [55, 55, 65, 55, 73, 55, 65, 61],
        leadNotes: [220, 0, 220, 246, 261, 0, 261, 196], // Melodia simples

        start(ctx) {
            if (this.playing) return;
            this.playing = true;
            this.playStep(ctx);
        },

        playStep(ctx) {
            if (!this.playing) return;
            const now = ctx.currentTime;

            // 1. BAIXO (Bass)
            const bass = ctx.createOscillator();
            const bassGain = ctx.createGain();
            bass.type = 'triangle';
            bass.frequency.value = this.bassNotes[this.step % 8];
            bassGain.gain.setValueAtTime(0.07, now);
            bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            bass.connect(bassGain);
            bassGain.connect(ctx.destination);
            bass.start(now);
            bass.stop(now + 0.2);

            // 2. BUMBO (Kick Drum - a cada 4 steps)
            if (this.step % 4 === 0) {
                const kick = ctx.createOscillator();
                const kickGain = ctx.createGain();
                kick.frequency.setValueAtTime(150, now);
                kick.frequency.exponentialRampToValueAtTime(0.01, now + 0.5);
                kickGain.gain.setValueAtTime(0.45, now);
                kickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                kick.connect(kickGain);
                kickGain.connect(ctx.destination);
                kick.start(now);
                kick.stop(now + 0.5);
            }

            // 3. HI-HAT (Prato - a cada 2 steps)
            if (this.step % 2 === 1) {
                const noise = ctx.createBufferSource();
                const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
                noise.buffer = buffer;
                const hhGain = ctx.createGain();
                hhGain.gain.setValueAtTime(0.04, now);
                hhGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                noise.connect(hhGain);
                hhGain.connect(ctx.destination);
                noise.start(now);
            }

            // 4. LEAD (Melodia - se nota > 0)
            const leadFreq = this.leadNotes[this.step % 8];
            if (leadFreq > 0 && Math.random() > 0.3) {
                const lead = ctx.createOscillator();
                const leadGain = ctx.createGain();
                lead.type = 'sawtooth';
                lead.frequency.value = leadFreq;
                leadGain.gain.setValueAtTime(0.035, now);
                leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                lead.connect(leadGain);
                leadGain.connect(ctx.destination);
                lead.start(now);
                lead.stop(now + 0.4);
            }

            this.step++;
            setTimeout(() => this.playStep(ctx), 200);
        },

        stop() {
            this.playing = false;
        }
    },

    playVictory() {
        if (!this.ctx) return;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // Arpejo de Dó Major
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.1);
            gain.gain.setValueAtTime(0.08, this.ctx.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.1 + 0.3);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(this.ctx.currentTime + i * 0.1);
            osc.stop(this.ctx.currentTime + i * 0.1 + 0.3);
        });
    }
};

/**
 * Inicializa os jogadores
 */
function resetPlayers() {
    AudioEngine.init(); // Inicializa áudio no reset por garantia
    player1 = {
        id: 1,
        x: 100,
        y: GAME_HEIGHT / 2 - PLAYER_SIZE / 2,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        vida: INITIAL_LIVES,
        balas: MAX_AMMO,
        color: COLORS.p1,
        dir: 1,
        dashReady: true,
        shootReady: true,
        shield: false,
        invulnerable: false,
        angle: 0,
        chargeTime: 0,
        recoilOffset: { x: 0, y: 0 },
        handState: 'pointing',
        destroyed: false,
        damageFlash: 0 // Novo: timer para flash de dano
    };

    player2 = {
        id: 2,
        x: GAME_WIDTH - 100 - PLAYER_SIZE,
        y: GAME_HEIGHT / 2 - PLAYER_SIZE / 2,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        vida: INITIAL_LIVES,
        balas: MAX_AMMO,
        color: COLORS.p2,
        dir: -1,
        dashReady: true,
        shootReady: true,
        shield: false,
        invulnerable: false,
        angle: Math.PI,
        chargeTime: 0,
        recoilOffset: { x: 0, y: 0 },
        handState: 'pointing',
        destroyed: false,
        damageFlash: 0
    };

    particles = [];
    uiEffects = [];
    dashGhosts = [];
    ammoBoxes = [];
    shockwaves = [];
    initStars();
    spawnAmmo();
    spawnObstacles();
    spawnShield();

    // Garante que o tempo e a câmera voltem ao normal no início de cada round
    gameSpeed = 1.0;
    camera.active = false;
    camera.targetBullet = null;
    camera.scale = 1.0;
    if (slowMoTimeout) clearTimeout(slowMoTimeout);
}

/**
 * Gera um escudo em posição aleatória
 */
function spawnShield() {
    if (Math.random() > 0.7) { // 30% de chance de spawnar um escudo
        const margin = 100;
        shieldBox = {
            x: margin + Math.random() * (GAME_WIDTH - 2 * margin),
            y: margin + Math.random() * (GAME_HEIGHT - 2 * margin),
            active: true
        };
    } else {
        shieldBox = null;
    }
}

/**
 * Gera obstáculos no centro
 */
function spawnObstacles() {
    obstacles = [];

    if (currentArena === 'classic') {
        // Barreira Única Central que se move (Sua ideia anterior)
        obstacles.push({
            x: GAME_WIDTH / 2 - 15,
            y: GAME_HEIGHT / 2 - 60,
            w: 30,
            h: 120,
            hp: 2,
            maxHp: 2,
            vy: 3,
            dir: 1
        });
    } else if (currentArena === 'chaos') {
        // CAOS: Duas barreiras menores girando ou se movendo rápido
        obstacles.push({
            x: GAME_WIDTH / 2 - 60, y: 100, w: 20, h: 80, hp: 1, maxHp: 1, vy: 5, dir: 1
        });
        obstacles.push({
            x: GAME_WIDTH / 2 + 40, y: GAME_HEIGHT - 180, w: 20, h: 80, hp: 1, maxHp: 1, vy: 5, dir: -1
        });
    } else if (currentArena === 'corridor') {
        // CORREDOR: Paredes laterais forçando o meio
        obstacles.push({ x: GAME_WIDTH / 2 - 20, y: 0, w: 40, h: 180, hp: 5, maxHp: 5, vy: 0, dir: 1 });
        obstacles.push({ x: GAME_WIDTH / 2 - 20, y: GAME_HEIGHT - 180, w: 40, h: 180, hp: 5, maxHp: 5, vy: 0, dir: 1 });
    }
}

function spawnAmmo() {
    const margin = 100;

    // Verifica se precisa de munição no LADO ESQUERDO (Rafael)
    const hasLeft = ammoBoxes.some(b => b.x < GAME_WIDTH / 2);
    if (!hasLeft) {
        ammoBoxes.push({
            x: margin + Math.random() * (GAME_WIDTH / 2 - 2 * margin),
            y: margin + Math.random() * (GAME_HEIGHT - 2 * margin),
            size: 24
        });
    }

    // Verifica se precisa de munição no LADO DIREITO (Rossetti)
    const hasRight = ammoBoxes.some(b => b.x > GAME_WIDTH / 2);
    if (!hasRight) {
        ammoBoxes.push({
            x: GAME_WIDTH / 2 + margin + Math.random() * (GAME_WIDTH / 2 - 2 * margin),
            y: margin + Math.random() * (GAME_HEIGHT - 2 * margin),
            size: 24
        });
    }
}

/**
 * Inicia o Jogo
 */
function startGame() {
    AudioEngine.init();
    AudioEngine.bgm.start(AudioEngine.ctx);
    resetPlayers();
    player1.vida = INITIAL_LIVES;
    player2.vida = INITIAL_LIVES;

    // Configura INTRO CINEMATOGRÁFICA
    gameActive = true;
    camera.active = false;
    camera.scale = 0.4; // Começa de longe (zoom de fora)
    camera.x = GAME_WIDTH / 2;
    camera.y = GAME_HEIGHT / 2;
    introTimer = 3; // Inicia em 3 segundos

    // Lógica de contagem regressiva por UI Effects
    const createCountdown = (num) => {
        uiEffects.push({
            x: GAME_WIDTH / 2,
            y: GAME_HEIGHT / 2 - 50,
            vy: 0,
            life: 1.0,
            text: num.toString(),
            color: COLORS.p1,
            isIntro: true
        });
    };

    createCountdown(3);

    // Agendador da contagem
    setTimeout(() => { if (gameActive) createCountdown(2); introTimer = 2; }, 1000);
    setTimeout(() => { if (gameActive) createCountdown(1); introTimer = 1; }, 2000);
    setTimeout(() => {
        if (gameActive) {
            uiEffects.push({
                x: GAME_WIDTH / 2,
                y: GAME_HEIGHT / 2 - 50,
                vy: 0,
                life: 1.0,
                text: 'EXECUTE!',
                color: '#fff',
                isIntro: true
            });
            introTimer = 0;
        }
    }, 3000);

    overlay.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    if (controlsHint) controlsHint.classList.add('hidden');

    // Inicia barreira central única
    if (obstacleTimer) clearInterval(obstacleTimer);
    spawnObstacles();

    requestAnimationFrame(gameLoop);
    lastTime = 0; // Reseta o tempo para o loop começar limpo
}

/**
 * Finaliza o Jogo
 */
function endGame(winner) {
    if (!gameActive) return; // Evita múltiplas chamadas se houver várias balas
    gameActive = false; // Bloqueia inputs imediatamente
    AudioEngine.bgm.stop();
    AudioEngine.playVictory();

    if (obstacleTimer) clearInterval(obstacleTimer);

    // Reseta câmera e mantêm o foco na arena inteira
    gameSpeed = 1.0;
    camera.active = false;
    camera.targetBullet = null;
    camera.scale = 1.0;
    camera.x = GAME_WIDTH / 2;
    camera.y = GAME_HEIGHT / 2;

    // Explosão massiva de destroços no perdedor
    const target = (winner === 1) ? player2 : player1;
    target.destroyed = true; // Jogador some instantaneamente

    // Efeito de Destroços e Partículas
    createDebris(target.x + target.width / 2, target.y + target.height / 2, target.color);
    createExplosion(target.x + target.width / 2, target.y + target.height / 2, '#fff');
    createExplosion(target.x + target.width / 2, target.y + target.height / 2, target.color);

    // Efeito de Ondas de Choque (Shockwaves)
    shockwaves.push({
        x: target.x + target.width / 2,
        y: target.y + target.height / 2,
        radius: 10,
        speed: 15,
        thickness: 25,
        decay: 0.02,
        alpha: 1.0,
        color: '#fff'
    });

    setTimeout(() => {
        if (shockwaves) {
            shockwaves.push({
                x: target.x + target.width / 2,
                y: target.y + target.height / 2,
                radius: 10,
                speed: 10,
                thickness: 15,
                decay: 0.015,
                alpha: 1.0,
                color: target.color
            });
        }
    }, 150);

    // Tremor de tela brutal
    screenShake = 40;

    setTimeout(() => {
        gameSpeed = 1.0;
        camera.active = false;
        camera.targetBullet = null;
        camera.scale = 1.0;
        debris = []; // Limpa destroços para o próximo round
        overlay.classList.remove('hidden');
        gameOverScreen.classList.remove('hidden');
        startBtn.classList.add('hidden');
        winnerText.innerText = winner === 1 ? "RAFAEL VENCEU!" : "ROSSETTI VENCEU!";
        winnerText.style.textShadow = `0 0 20px ${winner === 1 ? COLORS.p1 : COLORS.p2}`;
    }, 1500);
}

// Event Listeners
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

const soloBtn = document.getElementById('solo-btn');
const duoBtn = document.getElementById('duo-btn');

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

soloBtn.addEventListener('click', () => {
    isSoloMode = true;
    soloBtn.classList.add('selected');
    duoBtn.classList.remove('selected');
    document.getElementById('difficulty-selection').classList.remove('hidden');
});

duoBtn.addEventListener('click', () => {
    isSoloMode = false;
    duoBtn.classList.add('selected');
    soloBtn.classList.remove('selected');
    document.getElementById('difficulty-selection').classList.add('hidden');
});

// Arena Selection Listeners
const arenaBtns = {
    classic: document.getElementById('arena-classic'),
    chaos: document.getElementById('arena-chaos'),
    corridor: document.getElementById('arena-corridor')
};

Object.keys(arenaBtns).forEach(key => {
    arenaBtns[key].addEventListener('click', () => {
        currentArena = key;
        // Atualiza UI
        Object.values(arenaBtns).forEach(btn => btn.classList.remove('selected'));
        arenaBtns[key].classList.add('selected');
    });
});

// Difficulty Selection Listeners
const diffBtns = {
    easy: document.getElementById('diff-easy'),
    medium: document.getElementById('diff-medium'),
    hard: document.getElementById('diff-hard'),
    impossible: document.getElementById('diff-impossible')
};

Object.keys(diffBtns).forEach(key => {
    diffBtns[key].addEventListener('click', () => {
        botDifficulty = key;
        Object.values(diffBtns).forEach(btn => btn.classList.remove('selected'));
        diffBtns[key].classList.add('selected');
    });
});

/**
 * Lógica do TIRO
 */
function shoot(player, isCharged = false) {
    // Bloqueia tiro se o jogo não estiver ativo ou em slow motion cinematográfico
    if (!gameActive || camera.active) return;

    if (player.balas > 0 && player.shootReady) {
        // Conversão automática: se não tem munição para carregado, solta normal
        if (isCharged && player.balas < 2) isCharged = false;

        AudioEngine.playShoot();

        // Determina a direção vertical baseada no movimento atual
        let vDir = 0;
        if (player.id === 1) {
            if (keys['KeyW']) vDir = -4;
            else if (keys['KeyS']) vDir = 4;
        } else if (!isSoloMode) {
            if (keys['ArrowUp']) vDir = -4;
            else if (keys['ArrowDown']) vDir = 4;
        } else {
            // IA Inclinando o tiro se o alvo estiver longe verticalmente
            const diffY = player1.y - player.y;
            if (Math.abs(diffY) > 50) vDir = diffY > 0 ? 3 : -3;
        }

        bullets.push({
            x: player.dir === 1 ? player.x + player.width + BULLET_RADIUS : player.x - BULLET_RADIUS,
            y: player.y + player.height / 2,
            vx: player.dir * (isCharged ? BULLET_SPEED * 0.7 : BULLET_SPEED),
            vy: vDir,
            owner: player.id,
            color: player.color,
            bounces: 0,
            trail: [],
            isCharged: isCharged, // Novo: identifica se é um tiro gigante
            radius: isCharged ? 30 : BULLET_RADIUS
        });

        // Efeito de Recuo (Coice) na mão
        player.recoilOffset.x = -player.dir * (isCharged ? 15 : 8);

        player.balas -= isCharged ? 2 : 1;
        player.shootReady = false;
        screenShake = isCharged ? 10 : 3;

        // Inicia cooldown do tiro
        setTimeout(() => {
            player.shootReady = true;
        }, isCharged ? SHOOT_COOLDOWN * 2 : SHOOT_COOLDOWN);
    } else if (player.balas === 0 && player.shootReady) {
        AudioEngine.playError();
    }
}

/**
 * Atualização do Estado
 */
function update(speed) {
    const moveStep = PLAYER_SPEED * speed;
    const bulletStep = speed; // Multiplicador para o movimento das balas

    // ATUALIZA EFEITOS DE UI PRIMEIRO (Para a intro não travar)
    uiEffects.forEach((eff, idx) => {
        eff.y += eff.vy * speed;
        eff.life -= 0.02 * speed;
        if (eff.life <= 0) uiEffects.splice(idx, 1);
    });

    // Suavização da Câmera (Intro ou Retorno do Bullet Time)
    if (camera.active && camera.targetBullet) {
        camera.x = camera.targetBullet.x;
        camera.y = camera.targetBullet.y;
    } else if (!camera.active && camera.scale !== 1.0) {
        camera.scale += (1.0 - camera.scale) * 0.1 * speed; // Retorno do zoom
        camera.x += (GAME_WIDTH / 2 - camera.x) * 0.1 * speed; // Suaviza posição X para o centro
        camera.y += (GAME_HEIGHT / 2 - camera.y) * 0.1 * speed; // Suaviza posição Y para o centro

        if (Math.abs(camera.scale - 1.0) < 0.01) {
            camera.scale = 1.0;
            camera.x = GAME_WIDTH / 2;
            camera.y = GAME_HEIGHT / 2;
        }
    }

    // Bloqueia movimento se a intro estiver acontecendo
    if (introTimer > 0 || uiEffects.some(e => e.isIntro && e.text === 'EXECUTE!')) {
        return;
    }

    // Movimento e Dash Player 1
    if (keys['KeyW'] && player1.y > 0) { player1.y -= moveStep; player1.angle = -Math.PI / 2; }
    if (keys['KeyS'] && player1.y < GAME_HEIGHT - player1.height) { player1.y += moveStep; player1.angle = Math.PI / 2; }
    if (keys['KeyA'] && player1.x > 0) { player1.x -= moveStep; player1.angle = Math.PI; player1.dir = -1; }
    if (keys['KeyD'] && player1.x < GAME_WIDTH / 2 - player1.width) { player1.x += moveStep; player1.angle = 0; player1.dir = 1; }

    //Ângulos diagonais P1
    if (keys['KeyW'] && keys['KeyD']) player1.angle = -Math.PI / 4;
    if (keys['KeyW'] && keys['KeyA']) player1.angle = -3 * Math.PI / 4;
    if (keys['KeyS'] && keys['KeyD']) player1.angle = Math.PI / 4;
    if (keys['KeyS'] && keys['KeyA']) player1.angle = 3 * Math.PI / 4;

    // Movimentação da Barreira Central e Colisões
    obstacles.forEach(ob => {
        // Move para cima e para baixo (respeitando limites da arena)
        ob.y += ob.vy * ob.dir * speed;
        if (ob.y <= 20 || ob.y + ob.h >= GAME_HEIGHT - 20) {
            ob.dir *= -1;
        }

        // Colisão P1 com a Barreira
        if (player1.x < ob.x + ob.w && player1.x + player1.width > ob.x &&
            player1.y < ob.y + ob.h && player1.y + player1.height > ob.y) {
            if (player1.x < ob.x) player1.x = ob.x - player1.width;
            else if (player1.x > ob.x) player1.x = ob.x + ob.w;
        }
    });

    if (keys['ShiftLeft'] && player1.dashReady) {
        let dx = 0, dy = 0;
        if (keys['KeyW']) dy -= 1;
        if (keys['KeyS']) dy += 1;
        if (keys['KeyA']) dx -= 1;
        if (keys['KeyD']) dx += 1;

        // Se nenhuma tecla de direção, dash para frente padrão
        if (dx === 0 && dy === 0) dx = player1.dir;

        // Cria ecos na posição inicial ANTES do pulo
        createDashGhosts(player1);

        player1.x += dx * DASH_DISTANCE;
        player1.y += dy * DASH_DISTANCE;

        // Limites da tela para o dash
        player1.x = Math.max(0, Math.min(GAME_WIDTH / 2 - player1.width, player1.x));
        player1.y = Math.max(0, Math.min(GAME_HEIGHT - player1.height, player1.y));

        player1.dashReady = false;
        player1.handState = 'fist'; // Fecha o punho

        // Cria ecos também na posição final para completar o rastro
        createDashGhosts(player1);

        createExplosion(player1.x + player1.width / 2, player1.y + player1.height / 2, COLORS.p1);
        setTimeout(() => {
            player1.dashReady = true;
            player1.handState = 'pointing'; // Reabre
        }, DASH_COOLDOWN);
    }

    // Lógica de Carregamento de Tiro P1
    if (keys['Space'] && player1.balas >= 1) {
        player1.chargeTime += 16.6; // Aprox 60hz
    } else if (!keys['Space'] && player1.chargeTime > 0) {
        if (player1.chargeTime >= 800) shoot(player1, true);
        else shoot(player1, false);
        player1.chargeTime = 0;
    }

    // Movimento e Dash Player 2 (SOMENTE SE NÃO FOR BOT)
    if (!isSoloMode) {
        if (keys['ArrowUp'] && player2.y > 0) { player2.y -= moveStep; player2.angle = -Math.PI / 2; }
        if (keys['ArrowDown'] && player2.y < GAME_HEIGHT - player2.height) { player2.y += moveStep; player2.angle = Math.PI / 2; }
        if (keys['ArrowLeft'] && player2.x > GAME_WIDTH / 2) { player2.x -= moveStep; player2.angle = Math.PI; player2.dir = -1; }
        if (keys['ArrowRight'] && player2.x < GAME_WIDTH - player2.width) { player2.x += moveStep; player2.angle = 0; player2.dir = 1; }

        // Diagonais P2
        if (keys['ArrowUp'] && keys['ArrowRight']) player2.angle = -Math.PI / 4;
        if (keys['ArrowUp'] && keys['ArrowLeft']) player2.angle = -3 * Math.PI / 4;
        if (keys['ArrowDown'] && keys['ArrowRight']) player2.angle = Math.PI / 4;
        if (keys['ArrowDown'] && keys['ArrowLeft']) player2.angle = 3 * Math.PI / 4;
    }

    // Colisão P2 com Obstáculos
    obstacles.forEach(ob => {
        if (player2.x < ob.x + ob.w && player2.x + player2.width > ob.x &&
            player2.y < ob.y + ob.h && player2.y + player2.height > ob.y) {
            if (player2.x < ob.x) player2.x = ob.x - player2.width;
            else if (player2.x > ob.x) player2.x = ob.x + ob.w;
        }
    });

    if (!isSoloMode && keys['ShiftRight'] && player2.dashReady) {
        let dx = 0, dy = 0;
        if (keys['ArrowUp']) dy -= 1;
        if (keys['ArrowDown']) dy += 1;
        if (keys['ArrowLeft']) dx -= 1;
        if (keys['ArrowRight']) dx += 1;

        if (dx === 0 && dy === 0) dx = player2.dir;

        createDashGhosts(player2);
        player2.x += dx * DASH_DISTANCE;
        player2.y += dy * DASH_DISTANCE;

        // Limites da tela para o dash
        player2.x = Math.max(GAME_WIDTH / 2, Math.min(GAME_WIDTH - player2.width, player2.x));
        player2.y = Math.max(0, Math.min(GAME_HEIGHT - player2.height, player2.y));

        player2.dashReady = false;
        player2.handState = 'fist';
        createDashGhosts(player2);

        createExplosion(player2.x + player2.width / 2, player2.y + player2.height / 2, COLORS.p2);
        setTimeout(() => {
            player2.dashReady = true;
            player2.handState = 'pointing';
        }, DASH_COOLDOWN);
    }

    // Lógica de Carregamento de Tiro P2 (SÓ SE NÃO FOR BOT)
    if (!isSoloMode) {
        if (keys['Enter'] && player2.balas >= 1) {
            player2.chargeTime += 16.6;
        } else if (!keys['Enter'] && player2.chargeTime > 0) {
            if (player2.chargeTime >= 800) shoot(player2, true);
            else shoot(player2, false);
            player2.chargeTime = 0;
        }
    }

    // --- LÓGICA DE IA (SÓ SE J2 NÃO ESTIVER SENDO CONTROLADO) ---
    if (isSoloMode) {
        const now = Date.now();
        const lowAmmo = player2.balas <= 1;

        // IA Toma decisões baseada no tempo do jogo (afetado pelo slow motion e dificuldade)
        let decisionThreshold = 800; // Médio
        if (botDifficulty === 'easy') decisionThreshold = 1400;
        if (botDifficulty === 'hard') decisionThreshold = 400;
        if (botDifficulty === 'impossible') decisionThreshold = 100; // Reação quase instantânea

        botLastDecision += 16.6 * speed;
        if (botLastDecision > decisionThreshold || (lowAmmo && ammoBoxes.length > 0)) {
            botLastDecision = 0;

            const ammoBoxOnMySide = ammoBoxes.find(b => b.x > GAME_WIDTH / 2);

            if (lowAmmo && ammoBoxOnMySide) {
                // Prioridade: Munição no meu lado
                botAITarget.x = ammoBoxOnMySide.x;
                botAITarget.y = ammoBoxOnMySide.y;
            } else if (lowAmmo && !ammoBoxOnMySide) {
                // MUNIÇÃO NO LADO DO P1 E EU ESTOU VAZIO
                botAITarget.y = Math.random() * GAME_HEIGHT;
                botAITarget.x = GAME_WIDTH - (botDifficulty === 'impossible' ? 30 : (botDifficulty === 'hard' ? 50 : 100));
            } else {
                // Decide se ataca ou patrulha
                const attackAggression = botDifficulty === 'impossible' ? 0.05 : (botDifficulty === 'hard' ? 0.1 : (botDifficulty === 'medium' ? 0.3 : 0.6));
                if (Math.random() > attackAggression) {
                    botAITarget.y = player1.y + (Math.random() - 0.5) * (botDifficulty === 'impossible' ? 20 : (botDifficulty === 'hard' ? 50 : 150));
                    botAITarget.x = GAME_WIDTH - (botDifficulty === 'impossible' ? 100 : 150) - Math.random() * 200;
                } else {
                    botAITarget.y = 50 + Math.random() * (GAME_HEIGHT - 100);
                    botAITarget.x = GAME_WIDTH / 2 + 100 + Math.random() * (GAME_WIDTH / 2 - 200);
                }
            }
            botAITarget.x = Math.max(GAME_WIDTH / 2 + 5, botAITarget.x);
        }

        // Micro-oscilação visual (jitter): apenas uma leve variação secundária
        const jitterY = Math.sin(now / 500) * (lowAmmo ? 40 : 20);
        const jitterX = Math.cos(now / 700) * (lowAmmo ? 25 : 10);

        // Movimento Suave em direção ao alvo autônomo
        const speedMult = 1.0;
        let movingY = 0;
        let movingX = 0;

        // Zona morta maior (25px) para evitar trocas de direção infinitas
        if (player2.y < (botAITarget.y + jitterY) - 25) {
            player2.y += moveStep * speedMult;
            movingY = 1;
        } else if (player2.y > (botAITarget.y + jitterY) + 25) {
            player2.y -= moveStep * speedMult;
            movingY = -1;
        }

        if (player2.x < (botAITarget.x + jitterX) - 25) {
            player2.x += moveStep * speedMult;
            movingX = 1;
        } else if (player2.x > (botAITarget.x + jitterX) + 25) {
            player2.x -= moveStep * speedMult;
            movingX = -1;
        }

        // Atualização Suave do Ângulo (evita snapping brusco, respeita o slow motion)
        let targetAngle = player2.angle;
        if (movingX === 1) targetAngle = 0;
        else if (movingX === -1) targetAngle = Math.PI;
        else if (movingY === 1) targetAngle = Math.PI / 2;
        else if (movingY === -1) targetAngle = -Math.PI / 2;

        // Interpolação ponderada pela velocidade
        player2.angle += (targetAngle - player2.angle) * 0.1 * speed;

        // Limites Físicos Estritos (Não atravessar o centro jamais)
        player2.x = Math.max(GAME_WIDTH / 2 + 5, Math.min(GAME_WIDTH - player2.width, player2.x));
        player2.y = Math.max(0, Math.min(GAME_HEIGHT - player2.height, player2.y));

        // Atira se estiver alinhado verticalmente com o jogador
        const alignedThreshold = botDifficulty === 'impossible' ? 90 : (botDifficulty === 'hard' ? 70 : 50);
        const shootChance = botDifficulty === 'impossible' ? 0.12 : (botDifficulty === 'hard' ? 0.05 : 0.03);
        const aligned = Math.abs(player2.y - player1.y) < alignedThreshold;

        if (aligned && player2.balas > 0 && Math.random() < shootChance) {
            const useCharged = player2.balas >= 3 && Math.random() > (botDifficulty === 'hard' ? 0.6 : 0.8);
            if (useCharged) {
                // Bot carrega visualmente
                player2.chargeTime = 800;
                setTimeout(() => {
                    if (gameActive) shoot(player2, true);
                    player2.chargeTime = 0;
                }, 400);
            } else {
                shoot(player2, false);
            }
        }

        // Tenta desviar de balas com Dash reativo
        const dashDetectionDist = botDifficulty === 'impossible' ? 0.2 : (botDifficulty === 'hard' ? 0.4 : (botDifficulty === 'medium' ? 0.7 : 0.85));
        bullets.forEach(b => {
            if (b.owner === 1 && Math.abs(b.y - player2.y) < 60 && b.x > GAME_WIDTH * dashDetectionDist) {
                if (player2.dashReady) {
                    const dashDir = b.y > player2.y ? -1 : 1;
                    player2.y += dashDir * DASH_DISTANCE;
                    player2.y = Math.max(0, Math.min(GAME_HEIGHT - player2.height, player2.y));

                    createDashGhosts(player2);
                    player2.dashReady = false;
                    createExplosion(player2.x + player2.width / 2, player2.y + player2.height / 2, COLORS.p2);
                    setTimeout(() => player2.dashReady = true, DASH_COOLDOWN);
                }
            }
        });
    }

    // Suavização do Recuo (Cooldown visual)
    player1.recoilOffset.x *= 0.8;
    player2.recoilOffset.x *= 0.8;

    // Atualiza timers de Flash de Dano
    if (player1.damageFlash > 0) player1.damageFlash -= 16.6 * speed;
    if (player2.damageFlash > 0) player2.damageFlash -= 16.6 * speed;

    // Atirar (Input normal bloqueado se estiver carregando)
    // Os botões agora são gerenciados pela lógica de carga acima para evitar tiro duplo

    // Atualiza Balas
    bullets.forEach((bullet, index) => {
        bullet.trail.push({ x: bullet.x, y: bullet.y });
        if (bullet.trail.length > 8) bullet.trail.shift();

        bullet.x += bullet.vx * bulletStep;
        bullet.y += bullet.vy * bulletStep;

        // Ricochete Teto/Chão
        if (bullet.y < 0 || bullet.y > GAME_HEIGHT) {
            if (bullet.bounces < (bullet.isCharged ? 0 : 1)) {
                bullet.vy *= -1;
                bullet.y = bullet.y < 0 ? 0 : GAME_HEIGHT;
                bullet.bounces++;
                screenShake = 2;

                // Cancela Bullet Time se bater na "tabela"
                if (camera.targetBullet === bullet) {
                    gameSpeed = 1.0;
                    camera.active = false;
                    camera.targetBullet = null;
                }
            } else {
                if (camera.targetBullet === bullet) {
                    gameSpeed = 1.0;
                    camera.active = false;
                    camera.targetBullet = null;
                }
                bullets.splice(index, 1);
                return;
            }
        }

        // Ricochete Paredes Laterais
        if (bullet.x < 0 || bullet.x > GAME_WIDTH) {
            if (bullet.bounces < 1) {
                bullet.vx *= -1;
                bullet.x = bullet.x < 0 ? 0 : GAME_WIDTH;
                bullet.bounces++;
                screenShake = 2;

                // Cancela Bullet Time se bater na parede lateral
                if (camera.targetBullet === bullet) {
                    gameSpeed = 1.0;
                    camera.active = false;
                    camera.targetBullet = null;
                }
            } else {
                if (camera.targetBullet === bullet) {
                    gameSpeed = 1.0;
                    camera.active = false;
                    camera.targetBullet = null;
                }
                bullets.splice(index, 1);
                return;
            }
        }

        // Colisão com Obstáculos
        obstacles.forEach((ob, obIdx) => {
            if (bullet.x > ob.x && bullet.x < ob.x + ob.w &&
                bullet.y > ob.y && bullet.y < ob.y + ob.h) {

                ob.hp -= bullet.isCharged ? 3 : 1;
                AudioEngine.playHit();
                createExplosion(bullet.x, bullet.y, '#555');

                // Cancela Bullet Time se bater num obstáculo e memoriza local
                if (camera.targetBullet === bullet) {
                    gameSpeed = 1.0;
                    camera.active = false;
                    camera.x = bullet.x;
                    camera.y = bullet.y;
                    camera.targetBullet = null;
                }

                if (!bullet.isCharged) bullets.splice(index, 1);
                else screenShake = 6;

                if (ob.hp <= 0) {
                    createExplosion(ob.x + ob.w / 2, ob.y + ob.h / 2, '#fff');
                    obstacles.splice(obIdx, 1);

                    // Renasce em 10 segundos para manter o jogo dinâmico
                    setTimeout(spawnObstacles, 10000);
                }
                return;
            }
        });

        // DETECÇÃO ANTECIPADA DE BULLET TIME E CANCELAMENTO FORAM REMOVIDOS AQUI

        // Colisão com Jogadores
        const p1Hit = bullet.owner === 2 &&
            Math.abs(bullet.x - (player1.x + player1.width / 2)) < (bullet.radius + player1.width / 2) &&
            Math.abs(bullet.y - (player1.y + player1.height / 2)) < (bullet.radius + player1.height / 2);

        const p2Hit = bullet.owner === 1 &&
            Math.abs(bullet.x - (player2.x + player2.width / 2)) < (bullet.radius + player2.width / 2) &&
            Math.abs(bullet.y - (player2.y + player2.height / 2)) < (bullet.radius + player2.height / 2);

        if (p1Hit || p2Hit) {
            const victim = p1Hit ? player1 : player2;

            if (victim.shield) {
                victim.shield = false;
                createExplosion(bullet.x, bullet.y, '#fff');
                AudioEngine.playHit();

                // Reset de camera se acertar o escudo no slow mo
                if (camera.targetBullet === bullet) {
                    gameSpeed = 1.0;
                    camera.active = false;
                    camera.x = bullet.x;
                    camera.y = bullet.y;
                    camera.targetBullet = null;
                }

                bullets.splice(index, 1);
                return;
            }

            if (victim.invulnerable) {
                if (camera.targetBullet === bullet) {
                    gameSpeed = 1.0;
                    camera.active = false;
                    camera.targetBullet = null;
                }
                bullets.splice(index, 1);
                return;
            }

            AudioEngine.playHit();
            createExplosion(bullet.x, bullet.y, victim.color);
            screenShake = 15;
            victim.vida--;
            victim.damageFlash = 200; // Pisca por 200ms

            // Texto Flutuante de Dano
            uiEffects.push({
                x: victim.x + victim.width / 2,
                y: victim.y,
                vy: -2,
                life: 1.0,
                text: '-1 HP',
                color: '#fff',
                is67: true
            });

            lastHitTime[`p${victim.id}`] = Date.now(); // Marca tempo do hit para o HUD

            // NOVO: Reset de câmera obrigatório ao atingir o jogador (evita bug de slow infinito)
            if (camera.targetBullet === bullet) {
                gameSpeed = 1.0;
                camera.active = false;
                camera.x = bullet.x;
                camera.y = bullet.y;
                camera.targetBullet = null;
            }

            bullets.splice(index, 1); // Garante que a bala sumiu

            if (victim.vida <= 0) {
                endGame(p1Hit ? 2 : 1);
            } else {
                // Em vez de resetar tudo, damos invulnerabilidade temporária
                victim.invulnerable = true;
                setTimeout(() => victim.invulnerable = false, 1000);
            }
        }
    });

    // UI Effects Update (Movido para o topo da função update)

    // Dash Ghosts Update
    dashGhosts.forEach((g, idx) => {
        g.life -= 0.05 * speed;
        if (g.life <= 0) dashGhosts.splice(idx, 1);
    });

    // Partículas
    particles.forEach((p, idx) => {
        p.x += p.vx * bulletStep;
        p.y += p.vy * bulletStep;
        p.life -= 0.02 * speed;
        if (p.life <= 0) particles.splice(idx, 1);
    });

    // Destroços (Debris)
    debris.forEach((d, idx) => {
        d.x += d.vx * bulletStep;
        d.y += d.vy * bulletStep;
        d.angle += d.rotSpeed * speed;
        d.life -= 0.01 * speed;
        if (d.life <= 0) debris.splice(idx, 1);
    });

    // Shockwaves (Anéis de explosão)
    shockwaves.forEach((sw, idx) => {
        sw.radius += sw.speed * speed;
        sw.alpha -= sw.decay * speed;
        if (sw.alpha <= 0) shockwaves.splice(idx, 1);
    });

    // Colisão com Munição
    ammoBoxes.forEach((box, index) => {
        const p1Col = Math.abs(player1.x + player1.width / 2 - box.x) < 30 && Math.abs(player1.y + player1.height / 2 - box.y) < 30;
        const p2Col = Math.abs(player2.x + player2.width / 2 - box.x) < 30 && Math.abs(player2.y + player2.height / 2 - box.y) < 30;

        if (p1Col || p2Col) {
            const p = p1Col ? player1 : player2;
            p.balas = MAX_AMMO;
            createExplosion(box.x, box.y, COLORS.ammo);
            ammoBoxes.splice(index, 1);
            setTimeout(spawnAmmo, 2000);
        }
    });

    // Colisão com Escudo
    if (shieldBox && shieldBox.active) {
        const p1Col = Math.abs(player1.x + player1.width / 2 - shieldBox.x) < 30 && Math.abs(player1.y + player1.height / 2 - shieldBox.y) < 30;
        const p2Col = Math.abs(player2.x + player2.width / 2 - shieldBox.x) < 30 && Math.abs(player2.y + player2.height / 2 - shieldBox.y) < 30;

        if (p1Col || p2Col) {
            const p = p1Col ? player1 : player2;
            p.shield = true;
            shieldBox.active = false;
            createExplosion(shieldBox.x, shieldBox.y, '#fff');
            setTimeout(spawnShield, 10000);
        }
    }

    // bgX -= 0.5; // Movimento removido a pedido do usuário
    if (screenShake > 0) screenShake *= (1 - 0.1 * speed); // Atenuação proporcional ao tempo
}

/**
 * Renderização Principal (HUD e Jogo)
 */
function draw() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 1. DESENHA FUNDO (Parallax e Nebulosa)
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (bgImage.complete) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.drawImage(bgImage, 0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.restore();
    }

    // Camadas de Estrelas (Sempre se movendo levemente para a esquerda)
    bgX += 0.2 * gameSpeed;
    starLayers.forEach(layer => {
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = layer.alpha;
        layer.stars.forEach(star => {
            // Calcula posição com base no scroll global e velocidade da camada
            let sx = (star.x - bgX * layer.speed * 10) % GAME_WIDTH;
            if (sx < 0) sx += GAME_WIDTH;

            ctx.beginPath();
            ctx.arc(sx, star.y, layer.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    });
    if (!player1 || (!gameActive && gameSpeed === 1.0 && debris.length === 0 && shockwaves.length === 0 && particles.length === 0)) return;
    // 2. DESENHA HUD E ALERTAS (Sempre fixos na tela)
    drawHUD(player1, 20, 40, 'left');
    drawHUD(player2, GAME_WIDTH - 20, 40, 'right');

    if (player1.balas === 0 || player2.balas === 0) {
        ctx.save();
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 20px Orbitron';
        ctx.textAlign = 'center';
        if (Date.now() % 1000 < 500) {
            ctx.fillText('BUSQUE MUNIÇÃO NO CHÃO!', GAME_WIDTH / 2, 40);
        }
        ctx.restore();
    }

    // Efeito de Tela Crítica (Vignette) - Fixo
    if (player1.vida <= 1 || player2.vida <= 1) {
        ctx.save();
        const pulse = Math.sin(Date.now() / 150) * 0.25 + 0.25;
        const grad = ctx.createRadialGradient(GAME_WIDTH / 2, GAME_HEIGHT / 2, 0, GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH / 1.2);
        grad.addColorStop(0.6, 'transparent');
        grad.addColorStop(1, `rgba(255, 0, 0, ${pulse})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.restore();
    }

    // 3. --- ELEMENTOS DO MUNDO (AFETADOS PELO ZOOM) ---
    ctx.save();

    if (camera.active || camera.scale !== 1.0) {
        ctx.translate(GAME_WIDTH / 2, GAME_HEIGHT / 2);
        ctx.scale(camera.scale, camera.scale);
        ctx.translate(-camera.x, -camera.y);
    }

    // Aplica Screen Shake (Afeta o mundo)
    if (screenShake > 1) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    }

    // Divisória do Campo
    ctx.save();
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(GAME_WIDTH / 2, 60);
    ctx.lineTo(GAME_WIDTH / 2, GAME_HEIGHT - 20);
    ctx.stroke();
    ctx.restore();

    // Partículas
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
        ctx.restore();
    });

    // Texto Flutuante (Damage Numbers & Intro)
    uiEffects.forEach(eff => {
        ctx.save();
        ctx.globalAlpha = eff.life;
        ctx.fillStyle = eff.color;

        if (eff.isIntro) {
            // Estilo Especial para Intro (Contagem)
            ctx.font = '900 120px Orbitron'; // Números bem grandes
            ctx.textAlign = 'center';
            ctx.shadowBlur = 30;
            ctx.shadowColor = eff.color;

            // Efeito de Glitch no texto
            const glitchX = (Math.random() - 0.5) * 15;
            ctx.fillText(eff.text, eff.x + glitchX, eff.y);

            ctx.globalAlpha = eff.life * 0.4;
            ctx.fillStyle = '#fff';
            ctx.fillText(eff.text, eff.x - glitchX, eff.y + 10);
        } else {
            ctx.font = eff.is67 ? 'bold 28px Orbitron' : 'bold 20px Inter';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 10;
            ctx.shadowColor = eff.color;
            ctx.fillText(eff.is67 ? '67' : eff.text, eff.x, eff.y);

            if (eff.is67) {
                ctx.font = 'bold 16px Orbitron';
                ctx.fillText('-1 HP', eff.x + 35, eff.y - 15);
            }
        }
        ctx.restore();
    });

    // Dash Ghosts (After-images)
    dashGhosts.forEach(g => {
        ctx.save();
        ctx.translate(g.x + PLAYER_SIZE / 2, g.y + PLAYER_SIZE / 2);
        ctx.rotate(g.angle);
        ctx.globalAlpha = g.life * 0.4;
        drawHand(ctx, g.color, PLAYER_SIZE, PLAYER_SIZE, g.handState);
        ctx.restore();
    });

    // Destroços Neon (Debris)
    debris.forEach(d => {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.angle);
        ctx.globalAlpha = d.life;
        ctx.fillStyle = d.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = d.color;

        // Desenha pedaços triangulares/quadrados
        ctx.beginPath();
        ctx.moveTo(-d.size / 2, -d.size / 2);
        ctx.lineTo(d.size / 2, -d.size / 2);
        ctx.lineTo(0, d.size / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    });

    // Ondas de Choque da explosão do jogador
    shockwaves.forEach(sw => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = sw.thickness * sw.alpha;
        ctx.globalAlpha = sw.alpha;
        ctx.shadowBlur = 30;
        ctx.shadowColor = sw.color;
        ctx.stroke();
        ctx.restore();
    });

    // Obstáculos
    obstacles.forEach(ob => {
        ctx.save();
        ctx.fillStyle = ob.hp === 2 ? '#333' : '#111';
        ctx.strokeStyle = ob.hp === 2 ? '#666' : '#f00';
        ctx.lineWidth = 2;
        ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
        ctx.strokeRect(ob.x, ob.y, ob.w, ob.h);
        ctx.restore();
    });

    // Itens (Munição e Escudo)
    ammoBoxes.forEach(box => {
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = COLORS.ammo;
        ctx.fillStyle = COLORS.ammo;
        ctx.font = 'bold 24px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('67', box.x, box.y);
        ctx.restore();
    });

    if (shieldBox && shieldBox.active) {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#fff';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(shieldBox.x, shieldBox.y, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // Balas
    bullets.forEach(bullet => {
        // Remove rastro durante o Bullet Time para evitar efeito de "duplicação"
        if (!camera.active) {
            bullet.trail.forEach((t, i) => {
                ctx.save();
                ctx.fillStyle = bullet.color;
                ctx.globalAlpha = i / 20;
                ctx.font = `bold ${bullet.isCharged ? 24 : 12}px Orbitron`;
                ctx.fillText('67', t.x, t.y);
                ctx.restore();
            });
        }

        ctx.save();
        ctx.fillStyle = bullet.color;
        ctx.font = `bold ${bullet.isCharged ? 32 : 18}px Orbitron`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = bullet.isCharged ? 30 : 15;
        ctx.shadowColor = bullet.color;
        ctx.fillText('67', bullet.x, bullet.y);
        ctx.restore();
    });

    // Jogadores
    drawPlayer(player1);
    drawPlayer(player2);

    ctx.restore(); // Finaliza contexto de Zoom do Mundo
}

/**
 * Desenha uma mão estilizada (Finger 67)
 */
function drawHand(ctx, color, width, height, state) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Glow Principal
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;

    if (state === 'pointing') {
        // --- PALMA DA MÃO ---
        ctx.beginPath();
        ctx.moveTo(-18, -12);
        ctx.quadraticCurveTo(-25, 0, -18, 12);
        ctx.quadraticCurveTo(-10, 18, 8, 14);
        ctx.lineTo(8, -10);
        ctx.quadraticCurveTo(-10, -18, -18, -12);
        ctx.stroke();

        // --- DEDO INDICADOR ---
        ctx.beginPath();
        ctx.moveTo(8, -8);
        ctx.quadraticCurveTo(15, -10, 25, -8);
        ctx.quadraticCurveTo(28, -7, 25, -6);
        ctx.lineTo(8, -5);
        ctx.stroke();

        // --- DEDOS DOBRADOS ---
        ctx.beginPath();
        ctx.moveTo(8, -2); ctx.quadraticCurveTo(18, -2, 18, 1); ctx.quadraticCurveTo(18, 4, 8, 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, 4); ctx.quadraticCurveTo(16, 6, 16, 9); ctx.quadraticCurveTo(16, 12, 8, 10); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, 10); ctx.quadraticCurveTo(14, 12, 14, 15); ctx.quadraticCurveTo(14, 18, 8, 16); ctx.stroke();

        // --- POLEGAR ---
        ctx.beginPath();
        ctx.moveTo(-12, -14);
        ctx.quadraticCurveTo(-18, -22, -10, -28);
        ctx.quadraticCurveTo(-6, -30, -4, -24);
        ctx.lineTo(-2, -14);
        ctx.stroke();
    } else if (state === 'fist') {
        // --- PUNHO FECHADO (Para o DASH) ---
        ctx.beginPath();
        ctx.moveTo(-15, -15);
        ctx.quadraticCurveTo(-22, 0, -15, 15);
        ctx.quadraticCurveTo(0, 20, 12, 12);
        ctx.lineTo(12, -12);
        ctx.quadraticCurveTo(0, -20, -15, -15);
        ctx.stroke();

        // Detalhes dos dedos fechados no punho
        for (let i = -8; i <= 8; i += 5) {
            ctx.beginPath();
            ctx.moveTo(5, i);
            ctx.lineTo(12, i);
            ctx.stroke();
        }
    }

    // Preenchimento interno neon suave
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
}

/**
 * Desenha o Jogador como o Avatar de mão "Finger 67"
 */
function drawPlayer(p) {
    if (p.destroyed) return; // Se destruído, não desenha nada
    ctx.save();

    // Posicionamento com RECUO (Recoil)
    ctx.translate(p.x + p.width / 2 + p.recoilOffset.x, p.y + p.height / 2);

    // Rotaciona a mão para onde está apontando
    ctx.rotate(p.angle);

    ctx.shadowBlur = 15;
    ctx.shadowColor = p.color;

    // Efeito de Carregamento (Glow pulsante se chargeTime > 0)
    if (p.chargeTime > 0) {
        const pulse = Math.sin(Date.now() / 50) * 10 + 20;
        ctx.shadowBlur = pulse;
        ctx.shadowColor = '#fff';

        // Indicador circular de progresso
        ctx.beginPath();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.arc(0, 0, p.width * 1.2, -Math.PI / 2, -Math.PI / 2 + (Math.min(p.chargeTime, 800) / 800) * Math.PI * 2);
        ctx.stroke();
    }

    if (p.damageFlash > 0) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#fff';
        drawHand(ctx, '#fff', p.width, p.height, p.handState);
    } else if (p.vida <= 1 && Math.sin(Date.now() / 100) > 0) {
        ctx.shadowColor = '#ff0000';
        drawHand(ctx, '#ff0000', p.width, p.height, p.handState);
    } else {
        if (p.invulnerable || !p.dashReady) ctx.globalAlpha = 0.5;
        drawHand(ctx, p.color, p.width, p.height, p.handState);
    }

    ctx.restore();

    // Desenha Escudo Ativo 
    if (p.shield) {
        ctx.save();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fff';
        ctx.beginPath();
        ctx.arc(p.x + p.width / 2, p.y + p.height / 2, p.width * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

/**
 * Desenha o HUD (Vidas e Balas)
 */
function drawHUD(player, x, y, align) {
    ctx.save();

    // --- ANIMAÇÃO DE IMPACTO (SHAKE) NO HUD ---
    const timeSinceHit = Date.now() - lastHitTime[`p${player.id}`];
    let hudShakeX = 0;
    let hudShakeY = 0;
    if (timeSinceHit < 500) {
        hudShakeX = (Math.random() - 0.5) * 15 * (1 - timeSinceHit / 500);
        hudShakeY = (Math.random() - 0.5) * 15 * (1 - timeSinceHit / 500);
    }

    ctx.translate(hudShakeX, hudShakeY);

    // Efeito de Glitch se estiver com vida crítica (1 vida)
    let offsetX = 0;
    let glitchAlpha = 1;
    let hudColor = player.color;

    if (player.vida <= 1) {
        if (Math.random() > 0.8) {
            offsetX = (Math.random() - 0.5) * 8;
            glitchAlpha = 0.4 + Math.random() * 0.6;
            hudColor = Math.random() > 0.5 ? '#f00' : player.color;
        }
    }

    ctx.font = 'bold 24px Orbitron';
    ctx.fillStyle = hudColor;
    ctx.textAlign = align;
    ctx.globalAlpha = glitchAlpha;

    const label = player.id === 1 ? 'RAFAEL' : (isSoloMode ? 'ROSSETTI [BOT]' : 'ROSSETTI');

    // --- CORAÇÕES QUE PULSAM ---
    const heartIcon = '❤️';
    const deadHeart = '🖤';
    const heartScale = 1 + Math.sin(Date.now() / 200) * 0.1;

    // Desenha Label
    ctx.fillText(label, x + offsetX, y);

    // Desenha Vidas com animação
    ctx.font = '32px Inter';
    let livesStr = '';
    for (let i = 0; i < INITIAL_LIVES; i++) {
        livesStr += i < player.vida ? heartIcon : deadHeart;
    }
    ctx.fillText(livesStr, x + offsetX, y + 40);

    // --- MUNIÇÃO PULSANTE SE VAZIA ---
    const ammoIcon = '⚡';
    let ammoScale = 1.0;
    if (player.balas === 0) {
        ammoScale = 1 + Math.sin(Date.now() / 100) * 0.2;
        ctx.fillStyle = '#ff4444';
    } else {
        ctx.fillStyle = '#fff';
    }

    ctx.save();
    ctx.translate(x + (align === 'right' ? -40 : 40), y + 80);
    ctx.scale(ammoScale, ammoScale);
    ctx.font = 'bold 22px Orbitron';
    ctx.fillText(`${align === 'left' ? ammoIcon : ''} ${player.balas}/${MAX_AMMO} ${align === 'right' ? ammoIcon : ''}`, 0, 0);
    ctx.restore();

    // Indicador de DASH
    if (player.dashReady) {
        ctx.fillStyle = player.color;
        ctx.font = 'bold 12px Orbitron';
        ctx.fillText('DASH PRONTO', x + offsetX, y + 110);
    }

    ctx.restore();
}

/**
 * Loop do Jogo com suporte a Slow Motion
 */
let lastTime = 0;
function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    lastTime = timestamp;

    update(gameSpeed);
    draw();
    const vfxActive = debris.length > 0 || shockwaves.length > 0 || particles.length > 0 || uiEffects.length > 0 || dashGhosts.length > 0;
    if (gameActive || vfxActive || gameSpeed < 1.0) requestAnimationFrame(gameLoop);
}

// Inicializa estado visual (vazio até o jogo começar)

console.log(loaded);
