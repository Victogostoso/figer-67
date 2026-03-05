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
const PLAYER_SPEED = 5;
const BULLET_SPEED = 12;
const INITIAL_LIVES = 5;
const MAX_AMMO = 5;
const DASH_DISTANCE = 100;
const DASH_COOLDOWN = 1000; // 1 segundo
const SHOOT_COOLDOWN = 400; // Novo: 0.4s entre tiros para evitar bagunça

// Estado do Jogo
let gameActive = false;
let player1, player2;
let bullets = [];
let ammoBoxes = [];
let obstacles = []; // Novo: Obstáculos destrutíveis
let particles = []; // Novo: Sistema de partículas
let screenShake = 0; // Novo: Intensidade do tremor
let keys = {};

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
        vida: player1 ? player1.vida : INITIAL_LIVES,
        balas: MAX_AMMO,
        color: COLORS.p1,
        dir: 1, // 1 para direita, -1 para esquerda
        dashReady: true,
        shootReady: true
    };

    player2 = {
        id: 2,
        x: GAME_WIDTH - 100 - PLAYER_SIZE,
        y: GAME_HEIGHT / 2 - PLAYER_SIZE / 2,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        vida: player2 ? player2.vida : INITIAL_LIVES,
        balas: MAX_AMMO,
        color: COLORS.p2,
        dir: -1,
        dashReady: true,
        shootReady: true
    };

    particles = [];
    spawnAmmo(); // Garante que há munição no chão
    spawnObstacles();
}

/**
 * Gera obstáculos no centro
 */
function spawnObstacles() {
    obstacles = [];
    const count = 3; // 3 pilares de cobertura
    for (let i = 0; i < count; i++) {
        obstacles.push({
            x: GAME_WIDTH / 2 - 20,
            y: 100 + i * 180,
            w: 40,
            h: 80,
            hp: 2,
            maxHp: 2
        });
    }
}

/**
 * Gera uma caixa de munição no centro
 */
function spawnAmmo() {
    const margin = 150;
    ammoBoxes = [{
        x: margin + Math.random() * (GAME_WIDTH - 2 * margin),
        y: margin + Math.random() * (GAME_HEIGHT - 2 * margin),
        size: 24
    }];
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
    gameActive = true;
    overlay.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    if (controlsHint) controlsHint.classList.add('hidden');
    requestAnimationFrame(gameLoop);
}

/**
 * Finaliza o Jogo
 */
function endGame(winner) {
    AudioEngine.bgm.stop();
    AudioEngine.playVictory(); // Toca música de vitória
    gameActive = false;
    overlay.classList.remove('hidden');
    gameOverScreen.classList.remove('hidden');
    startBtn.classList.add('hidden');
    winnerText.innerText = winner === 1 ? "RAFAEL VENCEU!" : "ROSSETTI VENCEU!";
    winnerText.style.textShadow = `0 0 20px ${winner === 1 ? COLORS.p1 : COLORS.p2}`;
}

// Event Listeners
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

/**
 * Lógica do TIRO
 */
function shoot(player) {
    if (player.balas > 0 && player.shootReady) {
        AudioEngine.playShoot();

        // Determina a direção vertical baseada no movimento atual
        let vDir = 0;
        if (player.id === 1) {
            if (keys['KeyW']) vDir = -4;
            else if (keys['KeyS']) vDir = 4;
        } else {
            if (keys['ArrowUp']) vDir = -4;
            else if (keys['ArrowDown']) vDir = 4;
        }

        bullets.push({
            x: player.dir === 1 ? player.x + player.width + BULLET_RADIUS : player.x - BULLET_RADIUS,
            y: player.y + player.height / 2,
            vx: player.dir * BULLET_SPEED,
            vy: vDir, // Tiro reto por padrão, ou inclinado se estiver se movendo
            owner: player.id,
            color: player.color, // Atribui a cor do jogador à bala
            bounces: 0,
            trail: []
        });

        player.balas--;
        player.shootReady = false;
        screenShake = 3;

        // Inicia cooldown do tiro
        setTimeout(() => {
            player.shootReady = true;
        }, SHOOT_COOLDOWN);
    } else if (player.balas === 0 && player.shootReady) {
        AudioEngine.playError();
    }
}

/**
 * Atualização do Estado
 */
function update() {
    if (!gameActive) return;

    // Movimento e Dash Player 1
    if (keys['KeyW'] && player1.y > 0) player1.y -= PLAYER_SPEED;
    if (keys['KeyS'] && player1.y < GAME_HEIGHT - player1.height) player1.y += PLAYER_SPEED;
    if (keys['KeyA'] && player1.x > 0) player1.x -= PLAYER_SPEED;
    if (keys['KeyD'] && player1.x < GAME_WIDTH / 2 - player1.width) player1.x += PLAYER_SPEED;

    // Colisão P1 com Obstáculos
    obstacles.forEach(ob => {
        if (player1.x < ob.x + ob.w && player1.x + player1.width > ob.x &&
            player1.y < ob.y + ob.h && player1.y + player1.height > ob.y) {
            // Empurra para fora (simples)
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

        player1.x += dx * DASH_DISTANCE;
        player1.y += dy * DASH_DISTANCE;

        // Limites da tela para o dash
        player1.x = Math.max(0, Math.min(GAME_WIDTH / 2 - player1.width, player1.x));
        player1.y = Math.max(0, Math.min(GAME_HEIGHT - player1.height, player1.y));

        player1.dashReady = false;
        createExplosion(player1.x + player1.width / 2, player1.y + player1.height / 2, COLORS.p1);
        setTimeout(() => player1.dashReady = true, DASH_COOLDOWN);
    }

    // Movimento e Dash Player 2
    if (keys['ArrowUp'] && player2.y > 0) player2.y -= PLAYER_SPEED;
    if (keys['ArrowDown'] && player2.y < GAME_HEIGHT - player2.height) player2.y += PLAYER_SPEED;
    if (keys['ArrowLeft'] && player2.x > GAME_WIDTH / 2) player2.x -= PLAYER_SPEED;
    if (keys['ArrowRight'] && player2.x < GAME_WIDTH - player2.width) player2.x += PLAYER_SPEED;

    // Colisão P2 com Obstáculos
    obstacles.forEach(ob => {
        if (player2.x < ob.x + ob.w && player2.x + player2.width > ob.x &&
            player2.y < ob.y + ob.h && player2.y + player2.height > ob.y) {
            if (player2.x < ob.x) player2.x = ob.x - player2.width;
            else if (player2.x > ob.x) player2.x = ob.x + ob.w;
        }
    });

    if (keys['ShiftRight'] && player2.dashReady) {
        let dx = 0, dy = 0;
        if (keys['ArrowUp']) dy -= 1;
        if (keys['ArrowDown']) dy += 1;
        if (keys['ArrowLeft']) dx -= 1;
        if (keys['ArrowRight']) dx += 1;

        if (dx === 0 && dy === 0) dx = player2.dir;

        player2.x += dx * DASH_DISTANCE;
        player2.y += dy * DASH_DISTANCE;

        // Limites da tela para o dash
        player2.x = Math.max(GAME_WIDTH / 2, Math.min(GAME_WIDTH - player2.width, player2.x));
        player2.y = Math.max(0, Math.min(GAME_HEIGHT - player2.height, player2.y));

        player2.dashReady = false;
        createExplosion(player2.x + player2.width / 2, player2.y + player2.height / 2, COLORS.p2);
        setTimeout(() => player2.dashReady = true, DASH_COOLDOWN);
    }

    // Atirar
    if (keys['Space']) { shoot(player1); keys['Space'] = false; }
    if (keys['Enter']) { shoot(player2); keys['Enter'] = false; }

    // Atualiza Balas
    bullets.forEach((bullet, index) => {
        bullet.trail.push({ x: bullet.x, y: bullet.y });
        if (bullet.trail.length > 8) bullet.trail.shift();

        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        // Ricochete Teto/Chão
        if (bullet.y < 0 || bullet.y > GAME_HEIGHT) {
            if (bullet.bounces < 1) { // Reduzido para apenas 1 ricochete
                bullet.vy *= -1;
                bullet.y = bullet.y < 0 ? 0 : GAME_HEIGHT;
                bullet.bounces++;
                screenShake = 2;
            } else {
                bullets.splice(index, 1);
                return;
            }
        }

        // Ricochete Paredes Laterais
        if (bullet.x < 0 || bullet.x > GAME_WIDTH) {
            if (bullet.bounces < 1) { // Reduzido para apenas 1 ricochete
                bullet.vx *= -1;
                bullet.x = bullet.x < 0 ? 0 : GAME_WIDTH;
                bullet.bounces++;
                screenShake = 2;
            } else {
                bullets.splice(index, 1);
                return;
            }
        }

        // Colisão com Obstáculos
        obstacles.forEach((ob, obIdx) => {
            if (bullet.x > ob.x && bullet.x < ob.x + ob.w &&
                bullet.y > ob.y && bullet.y < ob.y + ob.h) {

                ob.hp--;
                AudioEngine.playHit();
                createExplosion(bullet.x, bullet.y, '#555'); // Poeira cinza
                bullets.splice(index, 1);
                screenShake = 4;

                if (ob.hp <= 0) {
                    createExplosion(ob.x + ob.w / 2, ob.y + ob.h / 2, '#fff'); // Explosão ao destruir
                    obstacles.splice(obIdx, 1);
                }
                return;
            }
        });

        // Colisão com Jogadores
        const p1Hit = bullet.owner === 2 &&
            bullet.x > player1.x && bullet.x < player1.x + player1.width &&
            bullet.y > player1.y && bullet.y < player1.y + player1.height;

        const p2Hit = bullet.owner === 1 &&
            bullet.x > player2.x && bullet.x < player2.x + player2.width &&
            bullet.y > player2.y && bullet.y < player2.y + player2.height;

        if (p1Hit || p2Hit) {
            const victim = p1Hit ? player1 : player2;
            AudioEngine.playHit();
            createExplosion(bullet.x, bullet.y, victim.color);
            screenShake = 15;
            victim.vida--;
            if (victim.vida <= 0) endGame(p1Hit ? 2 : 1);
            else resetPlayers();
        }
    });

    // Partículas
    particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) particles.splice(idx, 1);
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

    if (screenShake > 0) screenShake *= 0.9; // Atenuação do shake
}

/**
 * Renderização Principal (HUD e Jogo)
 */
function draw() {
    ctx.save();
    // Aplica Screen Shake
    if (screenShake > 0.5) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    }

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (!gameActive) {
        ctx.restore();
        return;
    }

    // Partículas
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1;

    // Efeito de Tela Crítica (Vignette Vermelha Pulsante)
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

    // Desenha HUD P1
    drawHUD(player1, 20, 40, 'left');

    // Desenha HUD P2
    drawHUD(player2, GAME_WIDTH - 20, 40, 'right');

    // Alerta de Recarregue
    if (player1.balas === 0 || player2.balas === 0) {
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 20px Orbitron';
        ctx.textAlign = 'center';
        if (Date.now() % 1000 < 500) {
            ctx.fillText('BUSQUE MUNIÇÃO NO CHÃO!', GAME_WIDTH / 2, 40);
        }
    }

    // Desenha Jogadores (Minimalistas Neon)
    drawPlayer(player1);
    drawPlayer(player2);

    // Desenha Divisória
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(GAME_WIDTH / 2, 60);
    ctx.lineTo(GAME_WIDTH / 2, GAME_HEIGHT - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Desenha Balas e Rastros
    bullets.forEach(bullet => {
        // Trail com a cor da bala
        bullet.trail.forEach((t, i) => {
            ctx.fillStyle = bullet.color;
            ctx.globalAlpha = i / 20; // Rastro suave
            ctx.font = 'bold 12px Orbitron';
            ctx.fillText('67', t.x, t.y);
        });
        ctx.globalAlpha = 1;

        ctx.save();
        ctx.fillStyle = bullet.color; // Cor neon única do jogador
        ctx.font = 'bold 18px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Glow impactante na cor da bala
        ctx.shadowBlur = 15;
        ctx.shadowColor = bullet.color;

        ctx.fillText('67', bullet.x, bullet.y);
        ctx.restore();
    });

    // Desenha Obstáculos
    obstacles.forEach(ob => {
        ctx.save();
        ctx.fillStyle = ob.hp === 2 ? '#333' : '#111';
        ctx.strokeStyle = ob.hp === 2 ? '#666' : '#f00'; // Vermelho se estiver quebrando
        ctx.lineWidth = 2;
        ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
        ctx.strokeRect(ob.x, ob.y, ob.w, ob.h);

        // Detalhes internos (cyber)
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#fff';
        ctx.fillRect(ob.x + 5, ob.y + 5, ob.w - 10, 2);
        ctx.restore();
    });

    // Desenha Caixa de Munição
    ammoBoxes.forEach(box => {
        ctx.save();
        // Glow da munição
        ctx.shadowBlur = 20;
        ctx.shadowColor = COLORS.ammo;

        ctx.fillStyle = COLORS.ammo;
        ctx.font = 'bold 24px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Desenha o 67 como o item de munição
        ctx.fillText('67', box.x, box.y);

        // Pequeno indicador flutuante
        ctx.font = '10px Inter';
        ctx.fillStyle = '#fff';
        ctx.fillText('RECARGA', box.x, box.y + 20);
        ctx.restore();
    });

    ctx.restore();
}

/**
 * Desenha o Jogador como um retângulo neon
 */
function drawPlayer(p) {
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    if (p.vida <= 1) {
        if (Math.sin(Date.now() / 100) > 0) {
            ctx.shadowColor = '#ff0000';
            ctx.fillStyle = '#ff0000';
        }
    }

    // Efeito de "ghosting" se dash estiver carregando
    if (!p.dashReady) ctx.globalAlpha = 0.6;
    ctx.fillRect(p.x, p.y, p.width, p.height);

    // Indica direção (Olho/Frente)
    ctx.fillStyle = '#000';
    if (p.dir === 1) ctx.fillRect(p.x + p.width - 5, p.y + 10, 5, 20);
    else ctx.fillRect(p.x, p.y + 10, 5, 20);

    ctx.restore();
}

/**
 * Desenha o HUD (Vidas e Balas)
 */
function drawHUD(player, x, y, align) {
    ctx.save();

    // Efeito de Glitch se estiver com vida crítica (1 vida)
    let offsetX = 0;
    let glitchAlpha = 1;
    let hudColor = player.color;

    if (player.vida <= 1) {
        // 20% de chance de glitch por frame para um efeito intermitente
        if (Math.random() > 0.8) {
            offsetX = (Math.random() - 0.5) * 8;
            glitchAlpha = 0.4 + Math.random() * 0.6;
            hudColor = Math.random() > 0.5 ? '#f00' : player.color;

            // Desenha um "fantasma" do glitch atrás
            ctx.fillStyle = '#f0f';
            ctx.globalAlpha = 0.3;
            const glitchLabel = player.id === 1 ? 'RAFAEL' : 'ROSSETTI';
            ctx.fillText(glitchLabel, x - offsetX, y);
        }
    }

    ctx.font = 'bold 24px Orbitron';
    ctx.fillStyle = hudColor;
    ctx.textAlign = align;
    ctx.globalAlpha = glitchAlpha;

    const label = player.id === 1 ? 'RAFAEL' : 'ROSSETTI';
    const heartIcon = '❤️';
    const ammoIcon = '⚡';

    // Vidas
    let livesStr = '';
    for (let i = 0; i < INITIAL_LIVES; i++) {
        livesStr += i < player.vida ? heartIcon : '🖤';
    }

    // Desenho
    ctx.fillText(label, x + offsetX, y);
    ctx.font = '32px Inter';
    ctx.fillText(livesStr, x + offsetX, y + 40);

    // Cor da munição
    ctx.font = 'bold 22px Orbitron';
    ctx.fillStyle = player.balas === 0 ? '#ff4444' : '#fff';
    ctx.fillText(`${align === 'left' ? ammoIcon : ''} ${player.balas}/${MAX_AMMO} ${align === 'right' ? ammoIcon : ''}`, x + offsetX, y + 80);

    // Indicador de DASH
    if (player.dashReady) {
        ctx.fillStyle = player.color;
        ctx.font = 'bold 12px Orbitron';
        ctx.fillText('DASH PRONTO', x + offsetX, y + 110);
    }

    // Alerta Crítico "DANGER"
    if (player.vida <= 1) {
        if (Date.now() % 400 < 200) {
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 12px Orbitron';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff0000';
            ctx.fillText('WARNING: CRITICAL STATUS', x + offsetX, y + 135);
        }
    }

    ctx.restore();
}

/**
 * Loop do Jogo
 */
function gameLoop() {
    update();
    draw();
    if (gameActive) requestAnimationFrame(gameLoop);
}

// Inicializa estado visual
ctx.fillStyle = 'white';
ctx.font = '20px Orbitron';
ctx.textAlign = 'center';
ctx.fillText('READY TO DUEL?', GAME_WIDTH / 2, GAME_HEIGHT / 2);
